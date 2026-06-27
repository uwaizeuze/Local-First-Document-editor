"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users,
  UserPlus,
  X,
  Crown,
  Pencil,
  Eye,
  Loader2,
  Mail,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  documentService,
  type DocumentMember,
  type LookupUser,
} from "@/services/document.service";
import type { DocumentRole } from "@/lib/db/schema";

interface ShareDocumentDialogProps {
  documentId: string;
  role: DocumentRole;
}

const ROLE_CONFIG = {
  owner: {
    label: "Owner",
    icon: Crown,
    className: "bg-violet-500/15 text-violet-400 border border-violet-500/30",
  },
  editor: {
    label: "Editor",
    icon: Pencil,
    className: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    className: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  },
} as const;

function RoleBadge({ role }: { role: "owner" | "editor" | "viewer" }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function MemberAvatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name ?? "User"}
        className="h-9 w-9 rounded-full object-cover ring-2 ring-border"
      />
    );
  }
  const initials = (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-xs font-semibold text-white ring-2 ring-border">
      {initials}
    </div>
  );
}

type EmailStatus = "idle" | "checking" | "found" | "not_found";

export function ShareDocumentDialog({ documentId, role }: ShareDocumentDialogProps) {
  const isOwner = role === "owner";

  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<DocumentMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Email lookup state
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [lookedUpUser, setLookedUpUser] = useState<LookupUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const data = await documentService.getMembers(documentId);
      setMembers(data.members);
    } catch {
      toast.error("Failed to load members.");
    } finally {
      setLoadingMembers(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (open) void fetchMembers();
  }, [open, fetchMembers]);

  // Debounced email lookup — fires 600 ms after the user stops typing
  const handleEmailChange = (value: string) => {
    setInviteEmail(value);
    setLookedUpUser(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailStatus("idle");
      return;
    }

    setEmailStatus("checking");

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await documentService.lookupUser(trimmed);
        if (result.found && result.user) {
          setLookedUpUser(result.user);
          setEmailStatus("found");
        } else {
          setEmailStatus("not_found");
        }
      } catch {
        setEmailStatus("idle");
      }
    }, 600);
  };

  // Clear lookup when dialog closes
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setInviteEmail("");
      setInviteRole("editor");
      setEmailStatus("idle");
      setLookedUpUser(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || emailStatus !== "found") return;

    setInviting(true);
    try {
      await documentService.addMember(documentId, inviteEmail.trim(), inviteRole);
      toast.success(
        `${lookedUpUser?.name ?? inviteEmail.trim()} invited as ${inviteRole}.`,
      );
      setInviteEmail("");
      setEmailStatus("idle");
      setLookedUpUser(null);
      await fetchMembers();
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to invite member.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member: DocumentMember) => {
    setRemovingId(member.userId);
    try {
      await documentService.removeMember(documentId, member.userId);
      toast.success(`Removed ${member.name ?? member.email} from this document.`);
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
    } catch (error: any) {
      toast.error(error.response?.data?.error ?? "Failed to remove member.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Manage access"
          title="Manage access"
        >
          <Users className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        {/* ── Header with title + close button ── */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Access
            </DialogTitle>

            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-muted h-7 w-7 rounded-full"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* ── Invite form (owner only) ── */}
        {isOwner && (
          <form onSubmit={(e) => void handleInvite(e)} className="space-y-3">
            <p className="text-muted-foreground text-sm font-medium">Invite people</p>

            <div className="flex gap-2">
              {/* Email input with status indicator */}
              <div className="relative flex-1">
                <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="Enter email address…"
                  value={inviteEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className={`pl-9 pr-9 transition-colors ${
                    emailStatus === "found"
                      ? "border-green-500/60 focus-visible:ring-green-500/40"
                      : emailStatus === "not_found"
                        ? "border-red-500/60 focus-visible:ring-red-500/40"
                        : ""
                  }`}
                  disabled={inviting}
                  autoComplete="off"
                />
                {/* Right-side status icon */}
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  {emailStatus === "checking" && (
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  )}
                  {emailStatus === "found" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {emailStatus === "not_found" && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>

              {/* Role selector */}
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                disabled={inviting}
                className="border-input bg-background text-foreground focus:ring-ring w-[110px] rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>

              {/* Invite button — only active when user is confirmed found */}
              <Button
                type="submit"
                size="icon"
                disabled={inviting || emailStatus !== "found"}
                aria-label="Send invite"
                title={
                  emailStatus !== "found"
                    ? "Enter a valid registered email first"
                    : "Send invite"
                }
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Email lookup feedback */}
            {emailStatus === "found" && lookedUpUser && (
              <div className="border-green-500/30 bg-green-500/10 flex items-center gap-3 rounded-lg border px-3 py-2">
                <MemberAvatar name={lookedUpUser.name} image={lookedUpUser.image} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-green-400">
                    {lookedUpUser.name ?? lookedUpUser.email}
                  </p>
                  {lookedUpUser.name && (
                    <p className="text-muted-foreground truncate text-xs">
                      {lookedUpUser.email}
                    </p>
                  )}
                </div>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              </div>
            )}

            {emailStatus === "not_found" && (
              <div className="border-red-500/30 bg-red-500/10 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No account found for this email address. The person must sign up first.
              </div>
            )}
          </form>
        )}

        {/* Divider */}
        <div className="border-border border-t" />

        {/* ── Members list ── */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm font-medium">
            {members.length} {members.length === 1 ? "person" : "people"} with access
          </p>

          {loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No members yet.
            </p>
          ) : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <MemberAvatar name={member.name} image={member.image} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.name ?? member.email}
                    </p>
                    {member.name && (
                      <p className="text-muted-foreground truncate text-xs">
                        {member.email}
                      </p>
                    )}
                  </div>

                  <RoleBadge role={member.role} />

                  {/* Remove — owner only, cannot remove the owner row */}
                  {isOwner && member.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:text-destructive h-7 w-7 shrink-0 text-muted-foreground"
                      disabled={removingId === member.userId}
                      onClick={() => void handleRemove(member)}
                      aria-label={`Remove ${member.name ?? member.email}`}
                      title="Remove member"
                    >
                      {removingId === member.userId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Role legend ── */}
        <div className="bg-muted/30 rounded-lg p-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Role permissions
          </p>
          <div className="space-y-1.5 text-xs">
            {(["owner", "editor", "viewer"] as const).map((r) => {
              const descriptions: Record<string, string> = {
                owner: "Full control — edit, invite & delete",
                editor: "Can read and edit the document",
                viewer: "Read-only access",
              };
              return (
                <div key={r} className="flex items-center gap-2">
                  <RoleBadge role={r} />
                  <span className="text-muted-foreground">{descriptions[r]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
