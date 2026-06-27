import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSnapshotSchema } from "@/lib/validations";
import {
  createSnapshot,
  listSnapshots,
  getLatestSnapshot,
  getSnapshot,
  getDocumentAccess,
  canEdit,
} from "@/lib/db/queries";
import { base64ToBuffer } from "@/lib/utils";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const latest = url.searchParams.get("latest") === "true";

  if (latest) {
    const snapshot = await getLatestSnapshot(id, session.user.id);
    if (!snapshot) {
      return NextResponse.json({ snapshot: null });
    }

    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        snapshot: Buffer.from(snapshot.snapshot).toString("base64"),
        stateVector: snapshot.stateVector
          ? Buffer.from(snapshot.stateVector).toString("base64")
          : null,
        createdAt: snapshot.createdAt,
      },
    });
  }

  const snapshots = await listSnapshots(id, session.user.id);
  return NextResponse.json({ snapshots });
}

export async function POST(request: Request, { params }: RouteParams) {
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
  const parsed = createSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const snapshotBuffer = Buffer.from(base64ToBuffer(parsed.data.snapshot));
  const stateVectorBuffer = parsed.data.stateVector
    ? Buffer.from(base64ToBuffer(parsed.data.stateVector))
    : undefined;

  const row = await createSnapshot(
    id,
    session.user.id,
    parsed.data.name,
    snapshotBuffer,
    stateVectorBuffer,
  );

  return NextResponse.json({ snapshot: row }, { status: 201 });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: documentId } = await params;
  const access = await getDocumentAccess(documentId, session.user.id);
  if (!access || !canEdit(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const snapshotId = body.snapshotId as string | undefined;
  if (!snapshotId) {
    return NextResponse.json({ error: "snapshotId required" }, { status: 400 });
  }

  const snapshot = await getSnapshot(snapshotId, documentId, session.user.id);
  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  return NextResponse.json({
    snapshot: Buffer.from(snapshot.snapshot).toString("base64"),
    stateVector: snapshot.stateVector
      ? Buffer.from(snapshot.stateVector).toString("base64")
      : null,
  });
}
