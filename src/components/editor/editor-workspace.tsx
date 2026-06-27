"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Sparkles, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CollaborativeEditor,
  type EditorHandle,
} from "@/components/editor/collaborative-editor";
import { ConnectionStatus } from "@/components/editor/connection-status";
import { PresenceAvatars } from "@/components/editor/presence-avatars";
import { VersionHistorySidebar } from "@/components/editor/version-history-sidebar";
import { AiAssistantSidebar } from "@/components/editor/ai-assistant-sidebar";
import { ShareDocumentDialog } from "@/components/editor/share-document-dialog";
import { useEditorStore } from "@/stores/editor-store";
import type { DocumentRole } from "@/lib/db/schema";
import { toast } from "sonner";
import { documentService } from "@/services/document.service";

interface EditorWorkspaceProps {
  documentId: string;
  initialTitle: string;
  role: DocumentRole;
  user: { id: string; name: string };
}

export function EditorWorkspace({
  documentId,
  initialTitle,
  role,
  user,
}: EditorWorkspaceProps) {
  const editorRef = useRef<EditorHandle>(null);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState("");
  const {
    isVersionSidebarOpen,
    isAiSidebarOpen,
    setVersionSidebarOpen,
    setAiSidebarOpen,
  } = useEditorStore();

  const readOnly = role === "viewer";
  const [savingTitle, setSavingTitle] = useState(false);

  const updateTitle = async (newTitle: string) => {
    if (!newTitle.trim()) {
      toast.error("Document title cannot be empty.");
      return;
    }

    try {
      setSavingTitle(true);

      const response = await documentService.updateDocument(
        documentId,
        newTitle.trim(),
      );

      toast.success(response.message ?? "Title updated successfully.");
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to update document title.");
    } finally {
      setSavingTitle(false);
    }
  };

  // const updateTitle = async (newTitle: string) => {
  //   await fetch(`/api/documents/${documentId}`, {
  //     method: "PATCH",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ title: newTitle }),
  //   });
  // };

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="border-border flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        {/* <Input
          className="max-w-md border-none bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
          value={title}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void updateTitle(title)}
        />

        {readOnly && (
          <span className="bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
            <Eye className="h-3 w-3" /> Viewer
          </span>
        )} */}

        <div className="flex items-center gap-2">
          <Input
            className="max-w-md border-none bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
            value={title}
            disabled={readOnly || savingTitle}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void updateTitle(title)}
          />

          {savingTitle && (
            <span className="text-muted-foreground text-sm">Saving...</span>
          )}
        </div>

        {readOnly && (
          <span className="bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
            <Eye className="h-3 w-3" />
            Viewer
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          <PresenceAvatars />
          <ConnectionStatus />
          <Button
            variant={isVersionSidebarOpen ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setVersionSidebarOpen(!isVersionSidebarOpen)}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant={isAiSidebarOpen ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setAiSidebarOpen(!isAiSidebarOpen)}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <ShareDocumentDialog documentId={documentId} role={role} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <CollaborativeEditor
            ref={editorRef}
            documentId={documentId}
            user={user}
            role={role}
            onContentChange={setContent}
          />
        </main>

        {isVersionSidebarOpen && (
          <VersionHistorySidebar
            documentId={documentId}
            readOnly={readOnly}
            onCreateSnapshot={async (name) => {
              await editorRef.current?.createSnapshot(name);
            }}
            onRestore={async (snapshotId) => {
              await editorRef.current?.restoreSnapshot(snapshotId);
            }}
          />
        )}

        {isAiSidebarOpen && (
          <AiAssistantSidebar
            documentContent={content}
            onInsert={(text) => void editorRef.current?.insertText(text)}
          />
        )}
      </div>
    </div>
  );
}
