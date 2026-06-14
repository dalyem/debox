import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  getCurrentUser,
  getOrCreateUser,
  requireHostRoom,
} from "./lib/auth";
import { allocateRoomCode, findRoomByCode } from "./lib/roomCodes";
import { emit, getGameRow, launchGame, resumeRound } from "./lib/engine";
import { getGame, getGameOrThrow } from "../src/lib/games";
import {
  ROOM_ENDED_GRACE_MS,
  ROOM_IDLE_EXPIRY_MS,
  isRoomTerminal,
} from "../src/lib/platform/types";

/**
 * Room Engine — room creation, lifecycle and status.
 *
 * Host-only mutations are guarded by `requireHostRoom` / `getOrCreateUser`.
 * Public queries return sanitized projections only (no host ids, no tokens).
 */

function metaFor(gameType: string) {
  return getGame(gameType)?.meta ?? null;
}

async function playerCount(ctx: QueryCtx, roomId: Id<"rooms">): Promise<number> {
  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  return players.length;
}

/** Sanitized room shape for public consumers (join/play). */
function publicRoom(room: Doc<"rooms">) {
  return {
    roomId: room._id,
    roomCode: room.roomCode,
    status: room.status,
    gameType: room.gameType,
    round: room.round ?? 0,
    maxPlayers: room.maxPlayers,
    minPlayers: room.minPlayers,
    shareUrl: room.shareUrl,
    startedAt: room.startedAt ?? null,
    endedAt: room.endedAt ?? null,
    terminal: isRoomTerminal(room.status),
  };
}

/* --------------------------------------------------------------- queries */

/** Resolve a join code → room basics (public). */
export const byCode = query({
  args: { roomCode: v.string() },
  handler: async (ctx, { roomCode }) => {
    const room = await findRoomByCode(ctx, roomCode);
    if (!room) return { found: false as const };
    return {
      found: true as const,
      ...publicRoom(room),
      game: metaFor(room.gameType),
      playerCount: await playerCount(ctx, room._id),
    };
  },
});

/** Reactive room summary by id (public) — status, round, final result. */
export const summary = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    return {
      ...publicRoom(room),
      game: metaFor(room.gameType),
      result: room.result ?? null,
      playerCount: await playerCount(ctx, room._id),
    };
  },
});

/** Full host view of a room for the TV/host screen (host-auth). */
export const hostRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await requireHostRoom(ctx, roomId);
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    return {
      room: {
        ...publicRoom(room),
        result: room.result ?? null,
        settings: room.settings ?? null,
        createdAt: room.createdAt,
      },
      game: metaFor(room.gameType),
      players: players
        .slice()
        .sort((a, b) => a.seat - b.seat)
        .map((p) => ({
          playerId: p._id,
          displayName: p.displayName,
          avatar: { color: p.avatarColor, emoji: p.avatarEmoji },
          seat: p.seat,
          isActive: p.isActive,
        })),
    };
  },
});

/** A host's rooms, newest first (host-auth). Powers dashboard + history. */
export const myRooms = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_host", (q) => q.eq("hostClerkId", user.clerkId))
      .order("desc")
      .take(60);
    return Promise.all(
      rooms.map(async (room) => ({
        ...publicRoom(room),
        createdAt: room.createdAt,
        game: metaFor(room.gameType),
        playerCount: await playerCount(ctx, room._id),
      })),
    );
  },
});

/* ------------------------------------------------------------- mutations */

/** Create a room + lobby (host-auth). Returns code + share URL. */
export const create = mutation({
  args: { gameType: v.string(), settings: v.optional(v.any()) },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);
    const engine = getGameOrThrow(args.gameType); // 400 if unknown game
    const code = await allocateRoomCode(ctx);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const now = Date.now();

    const roomId = await ctx.db.insert("rooms", {
      hostId: user._id,
      hostClerkId: user.clerkId,
      roomCode: code,
      shareUrl: `${base}/join/${code}`,
      gameType: args.gameType,
      status: "lobby",
      settings: args.settings,
      maxPlayers: engine.meta.maxPlayers,
      minPlayers: engine.meta.minPlayers,
      eventCursor: 0,
      moveCursor: 0,
      createdAt: now,
      expiresAt: now + ROOM_IDLE_EXPIRY_MS,
      lastActivityAt: now,
    });

    // Precise auto-expiry if the lobby is abandoned (cron is the backstop).
    await ctx.scheduler.runAfter(ROOM_IDLE_EXPIRY_MS, internal.sessions.expireIfIdle, {
      roomId,
    });

    return { roomId, roomCode: code, shareUrl: `${base}/join/${code}` };
  },
});

/** Launch the game (lobby → active). */
export const start = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await requireHostRoom(ctx, roomId);
    if (room.status !== "lobby") throw new Error("Room is not in the lobby");
    await launchGame(ctx, room);
    return { ok: true };
  },
});

/** Pause / resume an in-progress game (active ⇄ paused). */
export const pause = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await requireHostRoom(ctx, roomId);
    if (room.status !== "active") throw new Error("Game is not active");
    await ctx.db.patch(roomId, { status: "paused" });
    await emit(ctx, roomId, "game_pause", {}, "all");
    return { ok: true };
  },
});

export const unpause = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await requireHostRoom(ctx, roomId);
    if (room.status !== "paused") throw new Error("Game is not paused");
    await ctx.db.patch(roomId, { status: "active" });
    await emit(ctx, roomId, "game_resume", {}, "all");
    return { ok: true };
  },
});

/** Skip the round-summary pause and deal the next round now (host-auth). */
export const nextRound = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await requireHostRoom(ctx, roomId);
    await resumeRound(ctx, room);
    return { ok: true };
  },
});

/** End the game (active/paused → ended). Computes final standings. */
export const end = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await requireHostRoom(ctx, roomId);
    if (room.status !== "active" && room.status !== "paused") {
      throw new Error("Game is not in progress");
    }
    const now = Date.now();
    let result = room.result ?? null;
    const engine = getGame(room.gameType);
    const row = await getGameRow(ctx, roomId);
    if (engine && row) {
      try {
        result = engine.endGame(engine.deserializeState(row.state));
      } catch {
        // leave result as-is if the state can't be finalized
      }
    }
    await ctx.db.patch(roomId, {
      status: "ended",
      endedAt: now,
      result,
      expiresAt: now + ROOM_ENDED_GRACE_MS,
    });
    await emit(ctx, roomId, "game_end", { manual: true }, "all");
    await ctx.scheduler.runAfter(ROOM_ENDED_GRACE_MS, internal.sessions.autoCloseRoom, {
      roomId,
    });
    return { ok: true };
  },
});

/** Close the room (terminal — cannot be reopened). */
export const close = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await requireHostRoom(ctx, roomId);
    if (isRoomTerminal(room.status) && room.status !== "ended") {
      return { ok: true }; // already closed/expired
    }
    await emit(ctx, roomId, "room_close", {}, "all");
    await ctx.db.patch(roomId, { status: "closed", closedAt: Date.now() });
    return { ok: true };
  },
});
