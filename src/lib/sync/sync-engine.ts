import * as Y from "yjs";
import { base64ToBuffer, bufferToBase64 } from "@/lib/utils";
import {
  enqueueOfflineUpdate,
  getOfflineQueue,
  removeFromQueue,
  incrementRetry,
  getSyncMeta,
  setSyncMeta,
} from "./offline-queue";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  pulledCount: number;
  error?: string;
}

export async function pushUpdatesToServer(
  documentId: string,
  updates: Array<{ update: Uint8Array | string; clock: number }>,
): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    documentId,
    updates: updates.map((u) => ({
      update: typeof u.update === "string" ? u.update : bufferToBase64(u.update),
      clock: u.clock,
    })),
  };

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? res.statusText };
  }

  return { ok: true };
}

export async function pullUpdatesFromServer(
  documentId: string,
  sinceClock: number,
): Promise<Array<{ update: Uint8Array; clock: number }>> {
  const params = new URLSearchParams({
    documentId,
    sinceClock: String(sinceClock),
  });

  const res = await fetch(`/api/sync?${params}`);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    updates: Array<{ update: string; clock: number }>;
  };

  return (data.updates ?? []).map((u) => ({
    update: base64ToBuffer(u.update),
    clock: u.clock,
  }));
}

export function applyUpdatesToDoc(ydoc: Y.Doc, updates: Uint8Array[]): void {
  for (const update of updates) {
    Y.applyUpdate(ydoc, update, "remote");
  }
}

export async function flushOfflineQueue(documentId: string): Promise<number> {
  const queue = await getOfflineQueue(documentId);
  if (queue.length === 0) return 0;

  const sorted = [...queue].sort((a, b) => a.clock - b.clock);
  const updates = sorted.map((item) => ({
    update: base64ToBuffer(item.update),
    clock: item.clock,
  }));

  const result = await pushUpdatesToServer(documentId, updates);
  if (!result.ok) {
    for (const item of sorted) {
      await incrementRetry(item.id, result.error ?? "Push failed");
    }
    return 0;
  }

  for (const item of sorted) {
    await removeFromQueue(item.id);
  }

  const maxClock = Math.max(...sorted.map((s) => s.clock));
  await setSyncMeta(documentId, maxClock);
  return sorted.length;
}

async function fetchLatestSnapshotFromServer(
  documentId: string,
): Promise<{ snapshot: string; stateVector: string | null } | null> {
  const res = await fetch(`/api/documents/${documentId}/snapshots?latest=true`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    snapshot: { snapshot: string; stateVector: string | null } | null;
  };
  return data.snapshot;
}

export async function syncDocument(
  documentId: string,
  ydoc: Y.Doc,
  localClockRef: { current: number },
): Promise<SyncResult> {
  try {
    const flushed = await flushOfflineQueue(documentId);

    const meta = await getSyncMeta(documentId);
    const sinceClock = meta?.lastSyncedClock ?? 0;

    const remoteUpdates = await pullUpdatesFromServer(documentId, sinceClock);
    if (remoteUpdates.length > 0) {
      applyUpdatesToDoc(
        ydoc,
        remoteUpdates.map((u) => u.update),
      );
      const maxRemoteClock = Math.max(...remoteUpdates.map((u) => u.clock));
      await setSyncMeta(documentId, maxRemoteClock);
    } else if (sinceClock === 0) {
      const latestSnapshot = await fetchLatestSnapshotFromServer(documentId);
      if (latestSnapshot?.snapshot) {
        const snapshotUpdate = base64ToBuffer(latestSnapshot.snapshot);
        Y.applyUpdate(ydoc, snapshotUpdate, "remote");
      }
    }

    return {
      success: true,
      syncedCount: flushed,
      pulledCount: remoteUpdates.length,
    };
  } catch (err) {
    return {
      success: false,
      syncedCount: 0,
      pulledCount: 0,
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}

export type LocalUpdateHandler = ((
  update: Uint8Array,
  origin: unknown,
) => Promise<void>) & {
  flush: () => Promise<void>;
};

export function createLocalUpdateHandler(
  documentId: string,
  localClockRef: { current: number },
  isOnline: () => boolean,
  canEdit: () => boolean,
): LocalUpdateHandler {
  let pushTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdate: { update: Uint8Array; clock: number; id: string } | null = null;

  const schedulePush = async () => {
    if (!pendingUpdate) return;

    const updateToPush = pendingUpdate;
    pendingUpdate = null;

    if (isOnline()) {
      const result = await pushUpdatesToServer(documentId, [updateToPush]);
      if (result.ok) {
        await removeFromQueue(updateToPush.id);
        await setSyncMeta(documentId, updateToPush.clock);
      } else {
        pendingUpdate = updateToPush;
      }
    }
  };

  const flush = async () => {
    if (pushTimeout) {
      clearTimeout(pushTimeout);
      pushTimeout = null;
    }
    await schedulePush();
  };

  const handler = async (update: Uint8Array, origin: unknown) => {
    if (origin === "remote" || origin === "snapshot-restore") return;
    if (!canEdit()) return;

    localClockRef.current += 1;
    const clock = localClockRef.current;
    const id = await enqueueOfflineUpdate(documentId, update, clock);
    pendingUpdate = { update, clock, id };

    if (pushTimeout) clearTimeout(pushTimeout);
    pushTimeout = setTimeout(() => {
      void schedulePush();
    }, 100);
  };

  return Object.assign(handler, { flush });
}

export function getRetryDelay(retryCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), 30_000);
}

export function shouldRetry(retryCount: number): boolean {
  return retryCount < MAX_RETRIES;
}

export { MAX_RETRIES };
