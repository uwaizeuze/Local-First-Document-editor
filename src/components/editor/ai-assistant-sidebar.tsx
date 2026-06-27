"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const ACTIONS = [
  { id: "summarize", label: "Summarize" },
  { id: "improve", label: "Improve Writing" },
  { id: "grammar", label: "Fix Grammar" },
  { id: "generate", label: "Generate Content" },
] as const;

interface AiAssistantSidebarProps {
  documentContent: string;
  onInsert: (text: string) => void;
}

export function AiAssistantSidebar({
  documentContent,
  onInsert,
}: AiAssistantSidebarProps) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (action: string, content?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          content: content ?? documentContent,
          context: action === "generate" ? undefined : prompt || undefined,
        }),
      });

      const data = (await res.json()) as { result?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "AI request failed");
        return;
      }
      setResult(data.result ?? "");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">AI Assistant</h2>
      </div>

      <div className="space-y-2 border-b border-border p-4">
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              disabled={loading || !documentContent}
              onClick={() => void runAction(action.id)}
            >
              {action.label}
            </Button>
          ))}
        </div>
        <textarea
          className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Optional prompt or context..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button
          className="w-full"
          disabled={loading || !prompt.trim()}
          onClick={() => void runAction("generate", prompt)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Generate
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {error && (
          <p className="mb-2 text-sm text-destructive">{error}</p>
        )}
        {result ? (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-sm">{result}</p>
            <Separator />
            <Button variant="secondary" size="sm" onClick={() => onInsert(result)}>
              Insert into document
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select an action above to get AI-powered writing assistance.
          </p>
        )}
      </ScrollArea>
    </aside>
  );
}
