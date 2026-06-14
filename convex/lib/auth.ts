import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Host authentication helpers.
 *
 * Only hosts authenticate (via Clerk). Every host-only mutation funnels through
 * these so authorization is centralized and never trusted from the client.
 */

export async function getIdentityOrThrow(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("UNAUTHENTICATED: host sign-in required");
  }
  return identity;
}

/** Resolve (and lazily provision) the `users` row for the signed-in host. */
export async function getOrCreateUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await getIdentityOrThrow(ctx);
  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .unique();

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { lastSeenAt: now });
    return existing;
  }

  const id = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email: identity.email,
    name: identity.name ?? (identity.nickname as string | undefined),
    imageUrl: identity.pictureUrl,
    createdAt: now,
    lastSeenAt: now,
  });
  const user = await ctx.db.get(id);
  if (!user) throw new Error("Failed to create user");
  return user;
}

/** Read-only variant for queries: returns the host's user row or null. */
export async function getCurrentUser(
  ctx: QueryCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Load a room and assert the caller is its host. Used by host-only mutations. */
export async function requireHostRoom(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
): Promise<Doc<"rooms">> {
  const identity = await getIdentityOrThrow(ctx);
  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("NOT_FOUND: room does not exist");
  if (room.hostClerkId !== identity.subject) {
    throw new Error("FORBIDDEN: you are not the host of this room");
  }
  return room;
}
