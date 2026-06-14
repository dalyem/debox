import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Event Engine (read side).
 *
 * The reactive feed that drives TV + controller animations and notifications.
 * Events are written by the engine bridge (`lib/engine.ts`). Clients subscribe
 * here and animate any events newer than the last `seq` they've seen.
 */
export const feed = query({
  args: { roomId: v.id("rooms"), limit: v.optional(v.number()) },
  handler: async (ctx, { roomId, limit }) => {
    const take = Math.min(limit ?? 40, 100);
    const events = await ctx.db
      .query("events")
      .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(take);
    return events
      .reverse()
      .map((e) => ({
        id: e._id,
        seq: e.seq,
        type: e.type,
        audience: e.audience,
        payload: e.payload,
        createdAt: e.createdAt,
      }));
  },
});
