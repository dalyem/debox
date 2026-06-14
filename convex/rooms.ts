import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  getCurrentUser,
  getOrCreateUser,
  requireHostRoom,
} from "./lib/auth";
import { allocateRoomCode, findRoomByCode } from "./lib/roomCodes";
import { emit, getGameRow, launchGame, resumeRound } from "./lib/engine";
import { generateGuestToken, hashGuestToken } from "./lib/guestTokens";
import { getGame, getGameOrThrow } from "../src/lib/games";
import {
  ROOM_EMPTY_LOBBY_EXPIRY_MS,
  ROOM_ENDED_GRACE_MS,
  ROOM_IDLE_EXPIRY_MS,
  isRoomTerminal,
} from "../src/lib/platform/types";
import { pickAvatar } from "../src/lib/platform/avatars";

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
    hostMode: room.hostMode ?? "tv",
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

/** Is the signed-in caller the host of this room? Gates host controls in the
 *  player-mode controller. Returns false for guests. */
export const amIHost = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const room = await ctx.db.get(roomId);
    return !!room && room.hostClerkId === identity.subject;
  },
});

/* ------------------------------------------------------------- mutations */

type CreatedRoom = {
  roomId: Id<"rooms">;
  roomCode: string;
  shareUrl: string;
  hostMode: "tv" | "player";
  hostPlayer: {
    playerId: Id<"players">;
    guestToken: string;
    seat: number;
    displayName: string;
    avatar: { color: string; emoji: string };
  } | null;
};

/** Core room+lobby creation, shared by `create` and `startFreshSession`. */
async function createRoom(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { gameType: string; hostMode: "tv" | "player"; settings?: unknown },
): Promise<CreatedRoom> {
  const engine = getGameOrThrow(args.gameType); // 400 if unknown game
  const code = await allocateRoomCode(ctx);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrl = `${base}/join/${code}`;
  const now = Date.now();

  const roomId = await ctx.db.insert("rooms", {
    hostId: user._id,
    hostClerkId: user.clerkId,
    roomCode: code,
    shareUrl,
    gameType: args.gameType,
    status: "lobby",
    hostMode: args.hostMode,
    settings: args.settings,
    maxPlayers: engine.meta.maxPlayers,
    minPlayers: engine.meta.minPlayers,
    eventCursor: 0,
    moveCursor: 0,
    createdAt: now,
    expiresAt: now + ROOM_IDLE_EXPIRY_MS,
    lastActivityAt: now,
  });

  // In "player" mode the host plays too — seat them as the first player.
  let hostPlayer: CreatedRoom["hostPlayer"] = null;
  if (args.hostMode === "player") {
    const token = generateGuestToken();
    const guestTokenHash = await hashGuestToken(token);
    const salt = new Uint32Array(1);
    crypto.getRandomValues(salt);
    const avatar = pickAvatar(0, salt[0]!);
    const displayName = (user.name ?? "Host").slice(0, 18);
    const playerId = await ctx.db.insert("players", {
      roomId,
      displayName,
      guestTokenHash,
      avatarColor: avatar.color,
      avatarEmoji: avatar.emoji,
      seat: 0,
      isActive: true,
      isHost: true,
      joinedAt: now,
      lastSeenAt: now,
    });
    await emit(ctx, roomId, "player_join", { playerId, displayName, avatar, seat: 0 });
    hostPlayer = { playerId, guestToken: token, seat: 0, displayName, avatar };
  }

  // Precise auto-expiry: 3h idle (cron backstop) + a 30-min sweep for lobbies
  // nobody ever joins.
  await ctx.scheduler.runAfter(ROOM_IDLE_EXPIRY_MS, internal.sessions.expireIfIdle, {
    roomId,
  });
  await ctx.scheduler.runAfter(
    ROOM_EMPTY_LOBBY_EXPIRY_MS,
    internal.sessions.expireIfEmpty,
    { roomId },
  );

  return { roomId, roomCode: code, shareUrl, hostMode: args.hostMode, hostPlayer };
}

/** Create a room + lobby (host-auth). Returns code + share URL. */
export const create = mutation({
  args: {
    gameType: v.string(),
    hostMode: v.optional(v.union(v.literal("tv"), v.literal("player"))),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);
    return createRoom(ctx, user, {
      gameType: args.gameType,
      hostMode: args.hostMode ?? "tv",
      settings: args.settings,
    });
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

/**
 * Replay with the SAME players — deal a brand-new game (ended → active).
 * Everyone stays seated; scores, phases and the deck all reset.
 */
export const playAgain = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await requireHostRoom(ctx, roomId);
    if (room.status !== "ended") {
      throw new Error("You can only replay a finished game");
    }
    await launchGame(ctx, room); // re-seeds + re-deals, sets status → active
    await ctx.db.patch(roomId, { result: undefined, endedAt: undefined });
    await emit(ctx, roomId, "game_replay", {}, "all");
    return { ok: true };
  },
});

/**
 * Start a brand-new session for a NEW group — closes the finished room and
 * spins up a fresh one (new code) with the SAME game, host mode and settings.
 * Everyone simply joins the new code; no lobby-leave dance required. Returns
 * the new room (and the host's player session in "player" mode) so the client
 * can navigate straight into it.
 */
export const startFreshSession = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const old = await requireHostRoom(ctx, roomId);
    const user = await getOrCreateUser(ctx);

    // Retire the finished room so it doesn't linger.
    if (!isRoomTerminal(old.status)) {
      await emit(ctx, roomId, "room_close", {}, "all");
      await ctx.db.patch(roomId, { status: "closed", closedAt: Date.now() });
    }

    return createRoom(ctx, user, {
      gameType: old.gameType,
      hostMode: old.hostMode ?? "tv",
      settings: old.settings,
    });
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
