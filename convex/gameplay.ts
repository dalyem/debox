import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { authenticatePlayer } from "./lib/guestTokens";
import {
  applyPlayerMove,
  emit,
  privateView,
  publicView,
  resumeRound,
  runTurnTimeout,
} from "./lib/engine";
import { REACTION_EMOJIS } from "../src/lib/platform/types";

/** Minimum gap between a single player's reactions (server-enforced). */
const REACTION_COOLDOWN_MS = 1200;

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

/**
 * Fling a quick emoji reaction onto the shared screen (player-auth). Reactions
 * are ephemeral: they ride the normal event feed and are animated as transient
 * floaters, never stored as game state.
 */
export const sendReaction = mutation({
  args: {
    roomId: v.id("rooms"),
    guestToken: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, { roomId, guestToken, emoji }) => {
    if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
      throw new Error("INVALID: unknown reaction");
    }
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("NOT_FOUND: room");
    if (!["active", "paused", "ended"].includes(room.status)) {
      throw new Error("LOCKED: reactions aren't open right now");
    }
    const player = await authenticatePlayer(ctx, roomId, guestToken);

    // Server-side throttle: drop reactions fired faster than the cooldown so a
    // client can't bypass its UI cooldown and spam the event feed. Bounded read.
    const recent = await ctx.db
      .query("events")
      .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(12);
    const me = String(player._id);
    const now = Date.now();
    const reactedRecently = recent.some(
      (e) =>
        e.type === "reaction" &&
        String((e.payload as { playerId?: unknown })?.playerId) === me &&
        now - e.createdAt < REACTION_COOLDOWN_MS,
    );
    if (reactedRecently) return { ok: true };

    await emit(
      ctx,
      roomId,
      "reaction",
      { playerId: player._id, displayName: player.displayName, emoji },
      "all",
    );
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

/** Scheduled: a turn's timer expired — auto-resolve it (or reschedule). */
export const turnTimeout = internalMutation({
  args: { roomId: v.id("rooms"), seq: v.number() },
  handler: async (ctx, { roomId, seq }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return;
    await runTurnTimeout(ctx, room, seq);
  },
});
