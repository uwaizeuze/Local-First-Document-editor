import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { applyUpdatesToDoc, getRetryDelay, shouldRetry } from "@/lib/sync/sync-engine";
import { scheduleCallback } from "@/lib/yjs/document-session";

describe("CRDT merge (Yjs)", () => {
  it("merges concurrent edits without data loss", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const text1 = doc1.getText("content");
    const text2 = doc2.getText("content");

    text1.insert(0, "Hello ");
    text2.insert(0, "World");

    const update1 = Y.encodeStateAsUpdate(doc1);
    const update2 = Y.encodeStateAsUpdate(doc2);

    Y.applyUpdate(doc2, update1);
    Y.applyUpdate(doc1, update2);

    expect(doc1.getText("content").toString()).toBe(doc2.getText("content").toString());
    expect(doc1.getText("content").toString()).toContain("Hello");
    expect(doc1.getText("content").toString()).toContain("World");
  });

  it("applies multiple updates deterministically", () => {
    const doc = new Y.Doc();
    const text = doc.getText("content");

    const updates: Uint8Array[] = [];
    for (let i = 0; i < 5; i++) {
      text.insert(text.length, `${i}`);
      updates.push(Y.encodeStateAsUpdate(doc));
    }

    const fresh = new Y.Doc();
    applyUpdatesToDoc(fresh, updates);

    expect(fresh.getText("content").toString()).toBe("01234");
  });

  it("snapshot restore merges with live state via CRDT", () => {
    const live = new Y.Doc();
    const snapshot = new Y.Doc();

    live.getText("content").insert(0, "Live edit");
    snapshot.getText("content").insert(0, "Snapshot");

    const snapshotState = Y.encodeStateAsUpdate(snapshot);
    const liveState = Y.encodeStateAsUpdate(live);

    const merged = new Y.Doc();
    Y.applyUpdate(merged, snapshotState);
    Y.applyUpdate(merged, liveState, "snapshot-restore");

    const result = merged.getText("content").toString();
    expect(result).toContain("Snapshot");
    expect(result).toContain("Live edit");
  });
});

describe("Offline retry logic", () => {
  it("uses exponential backoff", () => {
    expect(getRetryDelay(0)).toBe(1000);
    expect(getRetryDelay(1)).toBe(2000);
    expect(getRetryDelay(2)).toBe(4000);
    expect(getRetryDelay(10)).toBe(30_000);
  });

  it("stops retrying after max attempts", () => {
    expect(shouldRetry(4)).toBe(true);
    expect(shouldRetry(5)).toBe(false);
  });
});

describe("Collaboration callback scheduling", () => {
  it("defers callbacks until the current call stack finishes", async () => {
    const callback = vi.fn();
    let executed = false;

    scheduleCallback(() => {
      executed = true;
      callback();
    });

    expect(executed).toBe(false);
    expect(callback).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(executed).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
