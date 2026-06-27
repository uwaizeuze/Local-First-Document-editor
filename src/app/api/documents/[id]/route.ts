import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateDocumentSchema } from "@/lib/validations";
import {
  getDocumentById,
  getDocumentAccess,
  updateDocumentTitle,
  deleteDocument,
  canEdit,
  canManageMembers,
} from "@/lib/db/queries";

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

  const doc = await getDocumentById(id, session.user.id);
  return NextResponse.json({ document: doc, role: access.role });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access || !canEdit(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const doc = await updateDocumentTitle(id, session.user.id, parsed.data.title);
  return NextResponse.json({ document: doc });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access || !canManageMembers(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteDocument(id, session.user.id);
  return NextResponse.json({ success: true });
}
