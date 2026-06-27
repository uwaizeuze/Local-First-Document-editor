import bcrypt from "bcryptjs";
import { eq, and, desc, gt, sql } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  documents,
  documentMembers,
  documentUpdates,
  documentSnapshots,
  syncRateLimits,
  type DocumentRole,
} from "./schema";

export async function withUserContext<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await db.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
  return fn();
}

export async function createUserWithPassword(
  email: string,
  password: string,
  name?: string,
) {
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: name ?? email.split("@")[0] })
    .returning();
  return user;
}

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function verifyPassword(password: string, hash: string | null) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function createDocument(userId: string, title?: string) {
  return withUserContext(userId, async () => {
    const [doc] = await db
      .insert(documents)
      .values({ title: title ?? "Untitled Document", ownerId: userId })
      .returning();

    await db.insert(documentMembers).values({
      documentId: doc.id,
      userId,
      role: "owner",
    });

    return doc;
  });
}

export async function listUserDocuments(userId: string, page = 1, limit = 10) {
  return withUserContext(userId, async () => {
    const offset = (page - 1) * limit;

    const docs = await db
      .select({
        id: documents.id,
        title: documents.title,
        ownerId: documents.ownerId,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        role: documentMembers.role,
      })
      .from(documentMembers)
      .innerJoin(documents, eq(documentMembers.documentId, documents.id))
      .where(eq(documentMembers.userId, userId))
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(documentMembers)
      .where(eq(documentMembers.userId, userId));

    return {
      documents: docs,
      total: Number(count),
      page,
      limit,
      totalPages: Math.ceil(Number(count) / limit),
    };
  });
}

export async function getDocumentAccess(documentId: string, userId: string) {
  return withUserContext(userId, async () => {
    const [member] = await db
      .select()
      .from(documentMembers)
      .where(
        and(
          eq(documentMembers.documentId, documentId),
          eq(documentMembers.userId, userId),
        ),
      )
      .limit(1);
    return member ?? null;
  });
}

export async function getDocumentById(documentId: string, userId: string) {
  return withUserContext(userId, async () => {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    return doc ?? null;
  });
}

export async function updateDocumentTitle(
  documentId: string,
  userId: string,
  title: string,
) {
  return withUserContext(userId, async () => {
    const [doc] = await db
      .update(documents)
      .set({ title, updatedAt: new Date() })
      .where(eq(documents.id, documentId))
      .returning();
    return doc ?? null;
  });
}

export async function deleteDocument(documentId: string, userId: string) {
  return withUserContext(userId, async () => {
    const [doc] = await db
      .delete(documents)
      .where(eq(documents.id, documentId))
      .returning();
    return doc ?? null;
  });
}

export async function addDocumentMember(
  documentId: string,
  ownerId: string,
  email: string,
  role: DocumentRole,
) {
  return withUserContext(ownerId, async () => {
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!targetUser) return { error: "User not found" as const };

    // Check if the user is already a member (role change vs new invite)
    const [existing] = await db
      .select()
      .from(documentMembers)
      .where(
        and(
          eq(documentMembers.documentId, documentId),
          eq(documentMembers.userId, targetUser.id),
        ),
      )
      .limit(1);

    const isNew = !existing;
    const previousRole = existing?.role ?? null;

    await db
      .insert(documentMembers)
      .values({ documentId, userId: targetUser.id, role })
      .onConflictDoUpdate({
        target: [documentMembers.documentId, documentMembers.userId],
        set: { role },
      });

    return { user: targetUser, role, isNew, previousRole };
  });
}


export async function listDocumentMembers(documentId: string, userId: string) {
  return withUserContext(userId, async () => {
    return db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: documentMembers.role,
      })
      .from(documentMembers)
      .innerJoin(users, eq(documentMembers.userId, users.id))
      .where(eq(documentMembers.documentId, documentId));
  });
}

export async function removeDocumentMember(
  documentId: string,
  requesterId: string,
  targetUserId: string,
) {
  return withUserContext(requesterId, async () => {
    // Requester must be owner
    const [requester] = await db
      .select()
      .from(documentMembers)
      .where(
        and(
          eq(documentMembers.documentId, documentId),
          eq(documentMembers.userId, requesterId),
        ),
      )
      .limit(1);

    if (!requester || requester.role !== "owner") {
      return { error: "Forbidden" as const };
    }

    // Cannot remove yourself (the owner)
    if (targetUserId === requesterId) {
      return { error: "Cannot remove yourself" as const };
    }

    await db
      .delete(documentMembers)
      .where(
        and(
          eq(documentMembers.documentId, documentId),
          eq(documentMembers.userId, targetUserId),
        ),
      );

    return { success: true };
  });
}

export async function appendDocumentUpdate(
  documentId: string,
  userId: string,
  update: Buffer,
  clock: number,
) {
  return withUserContext(userId, async () => {
    const [row] = await db
      .insert(documentUpdates)
      .values({ documentId, update, clock, createdBy: userId })
      .returning();
    await db
      .update(documents)
      .set({ updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    return row;
  });
}

export async function getDocumentUpdatesSince(
  documentId: string,
  userId: string,
  sinceClock: number,
) {
  return withUserContext(userId, async () => {
    return db
      .select({
        id: documentUpdates.id,
        update: documentUpdates.update,
        clock: documentUpdates.clock,
        createdAt: documentUpdates.createdAt,
      })
      .from(documentUpdates)
      .where(
        and(
          eq(documentUpdates.documentId, documentId),
          gt(documentUpdates.clock, sinceClock),
        ),
      )
      .orderBy(documentUpdates.clock);
  });
}

export async function getDocumentUpdatesSinceTimestamp(
  documentId: string,
  userId: string,
  sinceTimestamp: number,
) {
  return withUserContext(userId, async () => {
    return db
      .select({
        id: documentUpdates.id,
        update: documentUpdates.update,
        clock: documentUpdates.clock,
        createdAt: documentUpdates.createdAt,
      })
      .from(documentUpdates)
      .where(
        and(
          eq(documentUpdates.documentId, documentId),
          gt(documentUpdates.createdAt, new Date(sinceTimestamp)),
        ),
      )
      .orderBy(documentUpdates.createdAt);
  });
}

export async function getLatestClock(documentId: string, userId: string) {
  return withUserContext(userId, async () => {
    const [row] = await db
      .select({ clock: documentUpdates.clock })
      .from(documentUpdates)
      .where(eq(documentUpdates.documentId, documentId))
      .orderBy(desc(documentUpdates.clock))
      .limit(1);
    return row?.clock ?? 0;
  });
}

export async function createSnapshot(
  documentId: string,
  userId: string,
  name: string,
  snapshot: Buffer,
  stateVector?: Buffer,
) {
  return withUserContext(userId, async () => {
    const [row] = await db
      .insert(documentSnapshots)
      .values({
        documentId,
        name,
        snapshot,
        stateVector,
        createdBy: userId,
      })
      .returning();
    return row;
  });
}

export async function listSnapshots(documentId: string, userId: string) {
  return withUserContext(userId, async () => {
    return db
      .select({
        id: documentSnapshots.id,
        name: documentSnapshots.name,
        createdAt: documentSnapshots.createdAt,
        createdBy: documentSnapshots.createdBy,
        creatorName: users.name,
      })
      .from(documentSnapshots)
      .innerJoin(users, eq(documentSnapshots.createdBy, users.id))
      .where(eq(documentSnapshots.documentId, documentId))
      .orderBy(desc(documentSnapshots.createdAt));
  });
}

export async function getSnapshot(
  snapshotId: string,
  documentId: string,
  userId: string,
) {
  return withUserContext(userId, async () => {
    const [row] = await db
      .select()
      .from(documentSnapshots)
      .where(
        and(
          eq(documentSnapshots.id, snapshotId),
          eq(documentSnapshots.documentId, documentId),
        ),
      )
      .limit(1);
    return row ?? null;
  });
}

export async function getLatestSnapshot(documentId: string, userId: string) {
  return withUserContext(userId, async () => {
    const [row] = await db
      .select({
        id: documentSnapshots.id,
        snapshot: documentSnapshots.snapshot,
        stateVector: documentSnapshots.stateVector,
        createdAt: documentSnapshots.createdAt,
      })
      .from(documentSnapshots)
      .where(eq(documentSnapshots.documentId, documentId))
      .orderBy(desc(documentSnapshots.createdAt))
      .limit(1);
    return row ?? null;
  });
}

export async function checkRateLimit(
  userId: string,
  limit = Number(process.env.SYNC_RATE_LIMIT_PER_MINUTE ?? 120),
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60_000);

  const [existing] = await db
    .select()
    .from(syncRateLimits)
    .where(eq(syncRateLimits.userId, userId))
    .limit(1);

  if (!existing || existing.windowStart < windowStart) {
    await db
      .insert(syncRateLimits)
      .values({ userId, requestCount: 1, windowStart: now })
      .onConflictDoUpdate({
        target: syncRateLimits.userId,
        set: { requestCount: 1, windowStart: now },
      });
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.requestCount >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await db
    .update(syncRateLimits)
    .set({ requestCount: existing.requestCount + 1 })
    .where(eq(syncRateLimits.userId, userId));

  return { allowed: true, remaining: limit - existing.requestCount - 1 };
}

export function canEdit(role: DocumentRole | undefined): boolean {
  return role === "owner" || role === "editor";
}

export function canManageMembers(role: DocumentRole | undefined): boolean {
  return role === "owner";
}
