import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface OfflineQueueItem {
  id: string;
  documentId: string;
  update: string;
  clock: number;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

interface SyncMeta {
  documentId: string;
  lastSyncedClock: number;
  lastSyncedAt: number;
}

interface DocEditorDB extends DBSchema {
  offlineQueue: {
    key: string;
    value: OfflineQueueItem;
    indexes: { "by-document": string; "by-created": number };
  };
  syncMeta: {
    key: string;
    value: SyncMeta;
  };
}

const DB_NAME = "doc-editor-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DocEditorDB>> | null = null;

export function getOfflineDB() {
  if (!dbPromise) {
    dbPromise = openDB<DocEditorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const queue = db.createObjectStore("offlineQueue", { keyPath: "id" });
        queue.createIndex("by-document", "documentId");
        queue.createIndex("by-created", "createdAt");
        db.createObjectStore("syncMeta", { keyPath: "documentId" });
      },
    });
  }
  return dbPromise;
}

export async function enqueueOfflineUpdate(
  documentId: string,
  update: Uint8Array,
  clock: number,
): Promise<string> {
  const db = await getOfflineDB();
  const id = `${documentId}-${clock}-${Date.now()}`;
  const updateB64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(update).toString("base64")
      : btoa(String.fromCharCode(...update));

  await db.put("offlineQueue", {
    id,
    documentId,
    update: updateB64,
    clock,
    createdAt: Date.now(),
    retryCount: 0,
  });

  return id;
}

export async function getOfflineQueue(
  documentId?: string,
): Promise<OfflineQueueItem[]> {
  const db = await getOfflineDB();
  if (documentId) {
    return db.getAllFromIndex("offlineQueue", "by-document", documentId);
  }
  return db.getAll("offlineQueue");
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("offlineQueue", id);
}

export async function incrementRetry(id: string, error: string): Promise<void> {
  const db = await getOfflineDB();
  const item = await db.get("offlineQueue", id);
  if (item) {
    item.retryCount += 1;
    item.lastError = error;
    await db.put("offlineQueue", item);
  }
}

export async function getSyncMeta(documentId: string): Promise<SyncMeta | undefined> {
  const db = await getOfflineDB();
  return db.get("syncMeta", documentId);
}

export async function setSyncMeta(
  documentId: string,
  lastSyncedClock: number,
): Promise<void> {
  const db = await getOfflineDB();
  await db.put("syncMeta", {
    documentId,
    lastSyncedClock,
    lastSyncedAt: Date.now(),
  });
}

export type { OfflineQueueItem, SyncMeta };
