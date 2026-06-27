import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncPushSchema, syncPullSchema } from "@/lib/validations";
import {
  appendDocumentUpdate,
  getDocumentUpdatesSince,
  getDocumentAccess,
  checkRateLimit,
  canEdit,
} from "@/lib/db/queries";
import { base64ToBuffer } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = syncPullSchema.safeParse({
    documentId: searchParams.get("documentId"),
    sinceClock: searchParams.get("sinceClock") ?? 0,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const access = await getDocumentAccess(parsed.data.documentId, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimit = await checkRateLimit(session.user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const updates = await getDocumentUpdatesSince(
    parsed.data.documentId,
    session.user.id,
    parsed.data.sinceClock,
  );

  return NextResponse.json({
    updates: updates.map((u) => ({
      update: Buffer.from(u.update).toString("base64"),
      clock: u.clock,
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = syncPushSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const access = await getDocumentAccess(parsed.data.documentId, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canEdit(access.role)) {
    return NextResponse.json(
      { error: "Viewers cannot push changes" },
      { status: 403 },
    );
  }

  const rateLimit = await checkRateLimit(session.user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const results = [];
  for (const item of parsed.data.updates) {
    const updateBuffer = Buffer.from(base64ToBuffer(item.update));
    const row = await appendDocumentUpdate(
      parsed.data.documentId,
      session.user.id,
      updateBuffer,
      item.clock,
    );
    results.push({ id: row.id, clock: row.clock });
  }

  return NextResponse.json({ success: true, results });
}
