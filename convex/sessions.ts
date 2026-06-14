import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { emit } from "./lib/engine";
import type { Doc } from "./_generated/dataModel";

/**
 * Session Engine — expiration, cleanup and security sweeps.
 *
 * Two mechanisms keep abandoned rooms from lingering:
 *  • precise per-room scheduled checks (`expireIfIdle`, `autoCloseRoom`), armed
 *    by the room mutations via `ctx.scheduler`, and
 *  • a periodic `sweep` cron as a backstop for anything that slipped through.
 *
 * Terminal rooms (closed/expired) are never reopened.
 */

const LIVE_STATUSES: Doc<"rooms">["status"][] = [
  "pending",
  "lobby",
  "active",
  "paused",
];

/** Expire a single room if it has been idle past its TTL. */
export const expireIfIdle = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || !LIVE_STATUSES.includes(room.status)) return;
    if (Date.now() >= room.expiresAt) {
      await ctx.db.patch(roomId, { status: "expired" });
      await emit(ctx, roomId, "room_close", { reason: "expired" });
    }
  },
});

/** Close an ended room once its result-viewing grace period elapses. */
export const autoCloseRoom = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "ended") return;
    await ctx.db.patch(roomId, { status: "closed", closedAt: Date.now() });
  },
});

/** Cron backstop: expire idle live rooms and close ended rooms past grace. */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let expired = 0;
    let closed = 0;

    for (const status of LIVE_STATUSES) {
      const stale = await ctx.db
        .query("rooms")
        .withIndex("by_status_expiry", (q) =>
          q.eq("status", status).lte("expiresAt", now),
        )
        .take(200);
      for (const room of stale) {
        await ctx.db.patch(room._id, { status: "expired" });
        await emit(ctx, room._id, "room_close", { reason: "expired" });
        expired++;
      }
    }

    const ended = await ctx.db
      .query("rooms")
      .withIndex("by_status_expiry", (q) =>
        q.eq("status", "ended").lte("expiresAt", now),
      )
      .take(200);
    for (const room of ended) {
      await ctx.db.patch(room._id, { status: "closed", closedAt: now });
      closed++;
    }

    return { expired, closed };
  },
});
