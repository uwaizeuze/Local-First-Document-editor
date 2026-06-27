import { z } from "zod";

export const syncPushSchema = z.object({
  documentId: z.string().uuid(),
  updates: z
    .array(
      z.object({
        update: z.string().min(1).max(2_000_000),
        clock: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(50),
});

export const syncPullSchema = z.object({
  documentId: z.string().uuid(),
  sinceClock: z.coerce.number().int().nonnegative().default(0),
});

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200),
});

export const createSnapshotSchema = z.object({
  name: z.string().min(1).max(200),
  snapshot: z.string().min(1).max(10_000_000),
  stateVector: z.string().optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]),
});

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const aiRequestSchema = z.object({
  action: z.enum([
    "summarize",
    "improve",
    "generate",
    "grammar",
    "explain-diff",
  ]),
  content: z.string().min(1).max(50_000),
  context: z.string().max(10_000).optional(),
});

export type SyncPushInput = z.infer<typeof syncPushSchema>;
export type SyncPullInput = z.infer<typeof syncPullSchema>;
