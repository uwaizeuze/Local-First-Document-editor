import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db/queries";

/**
 * GET /api/users/lookup?email=...
 * Checks whether a registered user exists with this email.
 * Returns safe public fields only (no password hash).
 * Requires the caller to be authenticated.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = await getUserByEmail(email);

  if (!user) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  // Return only safe public fields
  return NextResponse.json({
    found: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });
}
