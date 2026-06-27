import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDocumentSchema } from "@/lib/validations";
import { createDocument, listUserDocuments } from "@/lib/db/queries";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const page = Number(searchParams.get("page") ?? 1);

  const limit = Number(searchParams.get("limit") ?? 9);

  const result = await listUserDocuments(session.user.id, page, limit);

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const doc = await createDocument(session.user.id, parsed.data.title);
  return NextResponse.json({ document: doc }, { status: 201 });
}
