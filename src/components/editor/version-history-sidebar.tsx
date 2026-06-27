"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/lib/utils";

interface Snapshot {
  id: string;
  name: string;
  createdAt: string;
  creatorName: string | null;
}

interface VersionHistorySidebarProps {
  documentId: string;
  onRestore: (snapshotId: string) => Promise<void>;
  onCreateSnapshot: (name: string) => Promise<void>;
  readOnly?: boolean;
}

export function VersionHistorySidebar({
  documentId,
  onRestore,
  onCreateSnapshot,
  readOnly,
}: VersionHistorySidebarProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    const res = await fetch(`/api/documents/${documentId}/snapshots`);
    if (res.ok) {
      const data = (await res.json()) as { snapshots: Snapshot[] };
      setSnapshots(data.snapshots);
    }
  };

  useEffect(() => {
    void fetchSnapshots();
  }, [documentId]);

  const handleCreate = async () => {
    if (!snapshotName.trim()) return;
    setLoading(true);
    try {
      await onCreateSnapshot(snapshotName.trim());
      setSnapshotName("");
      await fetchSnapshots();
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (snapshotId: string) => {
    setRestoring(snapshotId);
    try {
      await onRestore(snapshotId);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <History className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Version History</h2>
      </div>

      {!readOnly && (
        <div className="space-y-2 border-b border-border p-4">
          <p className="text-xs text-muted-foreground">
            Create manual snapshots for time travel. Restoring merges with live edits via CRDT.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Snapshot name..."
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            />
            <Button size="icon" onClick={() => void handleCreate()} disabled={loading}>
              <Camera className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {snapshots.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No snapshots yet
            </p>
          ) : (
            snapshots.map((snap, i) => (
              <div key={snap.id}>
                <div className="rounded-lg p-3 hover:bg-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{snap.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {snap.creatorName} · {formatRelativeTime(snap.createdAt)}
                      </p>
                    </div>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        disabled={restoring === snap.id}
                        onClick={() => void handleRestore(snap.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {i < snapshots.length - 1 && <Separator className="my-1" />}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
