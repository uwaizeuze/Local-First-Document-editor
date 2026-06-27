import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addMemberSchema } from "@/lib/validations";
import {
  addDocumentMember,
  listDocumentMembers,
  removeDocumentMember,
  getDocumentAccess,
  getDocumentById,
  canManageMembers,
} from "@/lib/db/queries";
import { sendInviteEmail, sendRoleChangedEmail } from "@/lib/email";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const members = await listDocumentMembers(id, session.user.id);
  return NextResponse.json({ members });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access || !canManageMembers(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await addDocumentMember(
    id,
    session.user.id,
    parsed.data.email,
    parsed.data.role,
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  // ── Send email notification (non-blocking — never fails the request) ──
  try {
    const doc = await getDocumentById(id, session.user.id);
    const inviterName = session.user.name ?? session.user.email ?? "Someone";
    const documentTitle = doc?.title ?? "Untitled Document";

    if (result.isNew) {
      // Fresh invite
      void sendInviteEmail({
        to: result.user.email,
        recipientName: result.user.name ?? result.user.email,
        inviterName,
        documentTitle,
        documentId: id,
        role: result.role,
      });
    } else if (result.previousRole && result.previousRole !== result.role) {
      // Role was changed
      void sendRoleChangedEmail({
        to: result.user.email,
        recipientName: result.user.name ?? result.user.email,
        changedByName: inviterName,
        documentTitle,
        documentId: id,
        oldRole: result.previousRole,
        newRole: result.role,
      });
    }
    // If role is the same, no email needed
  } catch (err) {
    console.error("[members POST] Email dispatch error:", err);
  }

  return NextResponse.json({ member: result }, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const targetUserId = (body as { userId?: string }).userId;

  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const result = await removeDocumentMember(id, session.user.id, targetUserId);

  if ("error" in result) {
    const status = result.error === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true });
}
