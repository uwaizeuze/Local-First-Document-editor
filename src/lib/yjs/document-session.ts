import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import {
  createLocalUpdateHandler,
  flushOfflineQueue,
  syncDocument,
} from "@/lib/sync/sync-engine";
import { getSyncMeta, getOfflineQueue } from "@/lib/sync/offline-queue";
import { base64ToBuffer } from "@/lib/utils";
import type { DocumentRole } from "@/lib/db/schema";

export interface CollaborationUser {
  id: string;
  name: string;
  color?: string;
}

export interface DocumentSessionOptions {
  documentId: string;
  user: CollaborationUser;
  role: DocumentRole;
  wsUrl?: string;
  onConnectionChange?: (status: "connected" | "disconnected" | "syncing") => void;
  onPresenceChange?: (users: CollaborationUser[]) => void;
  onReady?: () => void;
}

export function scheduleCallback(callback: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }

  setTimeout(callback, 0);
}

const USER_COLORS = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#a3e635",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export class DocumentSession {
  readonly ydoc: Y.Doc;
  readonly fragment: Y.XmlFragment;
  readonly indexeddb: IndexeddbPersistence;
  wsProvider: WebsocketProvider | null = null;

  private localClock = { current: 0 };
  private destroyed = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private flushPendingUpdates: (() => Promise<void>) | null = null;
  private readonly options: DocumentSessionOptions;

  constructor(options: DocumentSessionOptions) {
    this.options = options;
    this.ydoc = new Y.Doc();
    this.fragment = this.ydoc.getXmlFragment("blocknote");
    this.indexeddb = new IndexeddbPersistence(options.documentId, this.ydoc);
    void this.bootstrap();
  }

  private async bootstrap() {
    await this.indexeddb.whenSynced;

    const meta = await getSyncMeta(this.options.documentId);
    this.localClock.current = meta?.lastSyncedClock ?? 0;

    const updateHandler = createLocalUpdateHandler(
      this.options.documentId,
      this.localClock,
      () => navigator.onLine,
      () => this.canEdit(),
    );
    this.flushPendingUpdates = updateHandler.flush;
    this.ydoc.on("update", updateHandler);

    if (navigator.onLine) {
      await this.backgroundSync();
    }

    this.connectWebSocket();

    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        void this.backgroundSync();
      }
    }, 15_000);

    window.addEventListener("online", this.handleOnline);
    window.addEventListener("pagehide", this.handlePageHide);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    scheduleCallback(() => this.options.onReady?.());
  }

  private handlePageHide = () => {
    void this.flushBeforeUnload();
    void this.sendKeepaliveSync();
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      void this.flushBeforeUnload();
    }
  };

  private async flushBeforeUnload() {
    if (!navigator.onLine || this.destroyed) return;

    await this.flushPendingUpdates?.();
    await flushOfflineQueue(this.options.documentId);
  }

  private handleOnline = () => {
    void this.backgroundSync();
    if (this.canEdit() && !this.wsProvider) {
      this.connectWebSocket();
    }
  };

  private async sendKeepaliveSync() {
    const queue = await getOfflineQueue(this.options.documentId);
    if (queue.length === 0) return;

    const sorted = [...queue].sort((a, b) => a.clock - b.clock);
    const payload = JSON.stringify({
      documentId: this.options.documentId,
      updates: sorted.map((item) => ({
        update: item.update,
        clock: item.clock,
      })),
    });

    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }

  private connectWebSocket() {
    const wsUrl =
      this.options.wsUrl ?? process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

    this.wsProvider = new WebsocketProvider(wsUrl, this.options.documentId, this.ydoc, {
      connect: true,
      params: {
        userId: this.options.user.id,
        userName: this.options.user.name,
      },
    });

    this.wsProvider.on("status", ({ status }: { status: string }) => {
      scheduleCallback(() => {
        this.options.onConnectionChange?.(
          status === "connected" ? "connected" : "disconnected",
        );
      });
    });

    this.wsProvider.awareness.setLocalStateField("user", {
      id: this.options.user.id,
      name: this.options.user.name,
      color: this.options.user.color,
    });

    this.wsProvider.awareness.on("change", () => {
      const users: CollaborationUser[] = [];
      this.wsProvider?.awareness.getStates().forEach((state) => {
        const u = state.user as CollaborationUser | undefined;
        if (u?.id) users.push(u);
      });
      scheduleCallback(() => this.options.onPresenceChange?.(users));
    });
  }

  async backgroundSync() {
    scheduleCallback(() => this.options.onConnectionChange?.("syncing"));
    await syncDocument(this.options.documentId, this.ydoc, this.localClock);
    scheduleCallback(() => {
      this.options.onConnectionChange?.(
        this.wsProvider?.wsconnected ? "connected" : "disconnected",
      );
    });
  }

  canEdit(): boolean {
    return this.options.role === "owner" || this.options.role === "editor";
  }

  createSnapshot(): { snapshot: Uint8Array; stateVector: Uint8Array } {
    return {
      snapshot: Y.encodeStateAsUpdate(this.ydoc),
      stateVector: Y.encodeStateVector(this.ydoc),
    };
  }

  async restoreSnapshot(snapshotBase64: string): Promise<void> {
    const snapshot = base64ToBuffer(snapshotBase64);
    const newDoc = new Y.Doc();
    Y.applyUpdate(newDoc, snapshot);

    const currentState = Y.encodeStateAsUpdate(this.ydoc);
    const merged = new Y.Doc();
    Y.applyUpdate(merged, snapshot);
    Y.applyUpdate(merged, currentState, "snapshot-restore");

    const mergedState = Y.encodeStateAsUpdate(merged);
    Y.applyUpdate(this.ydoc, mergedState, "snapshot-restore");
  }

  destroy() {
    void this.destroyAsync();
  }

  async destroyAsync() {
    if (this.destroyed) return;
    this.destroyed = true;

    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("pagehide", this.handlePageHide);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);

    if (this.syncInterval) clearInterval(this.syncInterval);

    await this.flushPendingUpdates?.();
    if (navigator.onLine) {
      await flushOfflineQueue(this.options.documentId);
    }

    this.wsProvider?.destroy();
    this.indexeddb.destroy();
    this.ydoc.destroy();
  }
}
