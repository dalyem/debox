import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { authenticatePlayer } from "./lib/guestTokens";
import {
  applyPlayerMove,
  privateView,
  publicView,
  resumeRound,
} from "./lib/engine";

/**
 * Gameplay — the player-facing move pipeline and audience-safe projections.
 *
 * Moves are validated and applied entirely server-side via the engine bridge.
 * `publicState` is the TV's audience-safe view; `privateState` returns only the
 * requesting player's own hand. The client is never trusted.
 */

/** Submit a move (player-auth). Throws with a friendly reason if illegal. */
export const submitMove = mutation({
  args: { roomId: v.id("rooms"), guestToken: v.string(), move: v.any() },
  handler: async (ctx, { roomId, guestToken, move }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("NOT_FOUND: room");
    const player = await authenticatePlayer(ctx, roomId, guestToken);
    await applyPlayerMove(ctx, room, player, move);
    return { ok: true };
  },
});

/** Audience-safe public game state for the shared TV display. */
export const publicState = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    return publicView(ctx, room);
  },
});

/** Private game state for one controller (their hand only). */
export const privateState = query({
  args: { roomId: v.id("rooms"), guestToken: v.string() },
  handler: async (ctx, { roomId, guestToken }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    let playerId: string;
    try {
      const player = await authenticatePlayer(ctx, roomId, guestToken);
      playerId = player._id as string;
    } catch {
      return null;
    }
    return privateView(ctx, room, playerId);
  },
});

/** Scheduled: after the round-summary pause, deal the next round. */
export const resumeAfterRound = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return;
    await resumeRound(ctx, room);
  },
});
