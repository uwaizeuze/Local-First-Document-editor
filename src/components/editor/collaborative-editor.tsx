"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import type { WebsocketProvider } from "y-websocket";
import type * as Y from "yjs";
import {
  DocumentSession,
  getUserColor,
  type CollaborationUser,
} from "@/lib/yjs/document-session";
import { useEditorStore } from "@/stores/editor-store";
import { bufferToBase64 } from "@/lib/utils";
import type { DocumentRole } from "@/lib/db/schema";

export interface EditorHandle {
  createSnapshot: (name: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;
  insertText: (text: string) => Promise<void>;
  getContent: () => Promise<string>;
}

interface CollaborativeEditorProps {
  documentId: string;
  user: CollaborationUser;
  role: DocumentRole;
  onContentChange?: (text: string) => void;
}

interface CollaborationConfig {
  provider: WebsocketProvider;
  fragment: Y.XmlFragment;
  user: { name: string; color: string };
}

interface ConnectedBlockNoteEditorProps {
  collaboration: CollaborationConfig;
  documentId: string;
  readOnly: boolean;
  sessionRef: React.RefObject<DocumentSession | null>;
  onContentChange?: (text: string) => void;
  setSyncError: (error: string | null) => void;
}

const ConnectedBlockNoteEditor = forwardRef<EditorHandle, ConnectedBlockNoteEditorProps>(
  function ConnectedBlockNoteEditor(
    { collaboration, documentId, readOnly, sessionRef, onContentChange, setSyncError },
    ref,
  ) {
    const editor = useCreateBlockNote({
      collaboration,
    });

    const createSnapshot = useCallback(
      async (name: string) => {
        const session = sessionRef.current;
        if (!session) return;

        const { snapshot, stateVector } = session.createSnapshot();
        const res = await fetch(`/api/documents/${documentId}/snapshots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            snapshot: bufferToBase64(snapshot),
            stateVector: bufferToBase64(stateVector),
          }),
        });

        if (!res.ok) setSyncError("Failed to create snapshot");
      },
      [documentId, sessionRef, setSyncError],
    );

    const restoreSnapshot = useCallback(
      async (snapshotId: string) => {
        const session = sessionRef.current;
        if (!session) return;

        const res = await fetch(`/api/documents/${documentId}/snapshots`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId }),
        });

        if (!res.ok) {
          setSyncError("Failed to restore snapshot");
          return;
        }

        const data = (await res.json()) as { snapshot: string };
        await session.restoreSnapshot(data.snapshot);
      },
      [documentId, sessionRef, setSyncError],
    );

    useImperativeHandle(ref, () => ({
      createSnapshot,
      restoreSnapshot,
      insertText: async (text: string) => {
        const blocks = await editor.tryParseMarkdownToBlocks(text);
        const lastBlock = editor.document[editor.document.length - 1];
        if (lastBlock) {
          editor.insertBlocks(blocks, lastBlock.id, "after");
        }
      },
      getContent: async () => editor.blocksToMarkdownLossy(editor.document),
    }));

    useEffect(() => {
      if (!onContentChange) return;
      void editor.blocksToMarkdownLossy(editor.document).then(onContentChange);
    }, [editor, editor.document, onContentChange]);

    return (
      <BlockNoteView
        editor={editor}
        editable={!readOnly}
        theme="dark"
        className="min-h-[calc(100vh-8rem)]"
      />
    );
  },
);

export const CollaborativeEditor = forwardRef<EditorHandle, CollaborativeEditorProps>(
  function CollaborativeEditor({ documentId, user, role, onContentChange }, ref) {
    const sessionRef = useRef<DocumentSession | null>(null);
    const [sessionReady, setSessionReady] = useState(false);
    const [collaborationConfig, setCollaborationConfig] =
      useState<CollaborationConfig | null>(null);
    const {
      setConnectionStatus,
      setPresenceUsers,
      setSyncError,
      setLastSyncedAt,
    } = useEditorStore();

    const readOnly = role === "viewer";
    const userWithColor = { ...user, color: user.color ?? getUserColor(user.id) };

    useEffect(() => {
      const session = new DocumentSession({
        documentId,
        user: userWithColor,
        role,
        onConnectionChange: (status) => {
          setConnectionStatus(status === "connected" ? "connected" : status);
          if (status === "syncing") setLastSyncedAt(new Date());
        },
        onPresenceChange: setPresenceUsers,
        onReady: () => {
          setCollaborationConfig({
            provider: session.wsProvider!,
            fragment: session.fragment,
            user: { name: userWithColor.name, color: userWithColor.color },
          });
          setSessionReady(true);
        },
      });

      sessionRef.current = session;

      return () => {
        void session.destroyAsync();
        sessionRef.current = null;
        setSessionReady(false);
        setCollaborationConfig(null);
      };
    }, [documentId, user.id, user.name, role]);

    if (!sessionReady || !collaborationConfig) {
      return (
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      );
    }

    return (
      <ConnectedBlockNoteEditor
        ref={ref}
        key={documentId}
        collaboration={collaborationConfig}
        documentId={documentId}
        readOnly={readOnly}
        sessionRef={sessionRef}
        onContentChange={onContentChange}
        setSyncError={setSyncError}
      />
    );
  },
);
