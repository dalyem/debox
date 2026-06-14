import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findRoomByCode } from "./lib/roomCodes";
import {
  authenticatePlayer,
  generateGuestToken,
  hashGuestToken,
} from "./lib/guestTokens";
import { emit, touchRoom } from "./lib/engine";
import { isRoomTerminal } from "../src/lib/platform/types";
import { pickAvatar } from "../src/lib/platform/avatars";

/**
 * Player Engine — anonymous guests, reconnects and player state.
 *
 * Players never have accounts. `join` mints a signed guest token (returned once,
 * stored client-side). Every subsequent action re-authenticates from the
 * hashed token, so the client can never impersonate another player.
 */

/** Strip control characters, collapse whitespace, cap length. */
function sanitizeName(raw: string): string {
  const printable = Array.from(raw)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })
    .join("");
  const cleaned = printable.replace(/\s+/g, " ").trim().slice(0, 18);
  return cleaned.length > 0 ? cleaned : "Player";
}

function randomSalt(): number {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0]!;
}

function publicPlayer(p: {
  _id: unknown;
  displayName: string;
  avatarColor: string;
  avatarEmoji: string;
  seat: number;
  isActive: boolean;
}) {
  return {
    playerId: String(p._id),
    displayName: p.displayName,
    avatar: { color: p.avatarColor, emoji: p.avatarEmoji },
    seat: p.seat,
    isActive: p.isActive,
  };
}

/* --------------------------------------------------------------- queries */

/** Public roster for a room (lobby + TV). No tokens, ever. */
export const list = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    return players.slice().sort((a, b) => a.seat - b.seat).map(publicPlayer);
  },
});

/** "Who am I" for a controller. Returns null if the token is unrecognized. */
export const me = query({
  args: { roomId: v.id("rooms"), guestToken: v.string() },
  handler: async (ctx, { roomId, guestToken }) => {
    try {
      const player = await authenticatePlayer(ctx, roomId, guestToken);
      return publicPlayer(player);
    } catch {
      return null;
    }
  },
});

/* ------------------------------------------------------------- mutations */

/** Join a room as an anonymous guest. Returns a one-time guest token. */
export const join = mutation({
  args: { roomCode: v.string(), displayName: v.string() },
  handler: async (ctx, { roomCode, displayName }) => {
    const room = await findRoomByCode(ctx, roomCode);
    if (!room) throw new Error("NOT_FOUND: we couldn't find that room");
    if (room.status !== "lobby") {
      if (isRoomTerminal(room.status)) {
        throw new Error("ENDED: this game session has ended");
      }
      throw new Error("LOCKED: this game has already started");
    }

    const name = sanitizeName(displayName);
    const existing = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();
    if (existing.length >= room.maxPlayers) {
      throw new Error("FULL: this room is full");
    }

    const seat = existing.length;
    const token = generateGuestToken();
    const guestTokenHash = await hashGuestToken(token);
    const avatar = pickAvatar(seat, randomSalt());
    const now = Date.now();

    const playerId = await ctx.db.insert("players", {
      roomId: room._id,
      displayName: name,
      guestTokenHash,
      avatarColor: avatar.color,
      avatarEmoji: avatar.emoji,
      seat,
      isActive: true,
      joinedAt: now,
      lastSeenAt: now,
    });

    await touchRoom(ctx, room._id);
    await emit(ctx, room._id, "player_join", {
      playerId,
      displayName: name,
      avatar,
      seat,
    });

    return { playerId, guestToken: token, seat, roomId: room._id, avatar };
  },
});

/** Heartbeat / reconnect. Keeps the player "active" and the room alive. */
export const heartbeat = mutation({
  args: { roomId: v.id("rooms"), guestToken: v.string() },
  handler: async (ctx, { roomId, guestToken }) => {
    const player = await authenticatePlayer(ctx, roomId, guestToken);
    const now = Date.now();
    const wasInactive = !player.isActive;
    await ctx.db.patch(player._id, {
      lastSeenAt: now,
      isActive: true,
      disconnectedAt: undefined,
    });
    await touchRoom(ctx, roomId);
    if (wasInactive) {
      await emit(ctx, roomId, "player_reconnect", {
        playerId: player._id,
        displayName: player.displayName,
      });
    }
    return { ok: true };
  },
});

/** Mark the player disconnected (kept in the room for reconnects). */
export const leave = mutation({
  args: { roomId: v.id("rooms"), guestToken: v.string() },
  handler: async (ctx, { roomId, guestToken }) => {
    const player = await authenticatePlayer(ctx, roomId, guestToken);
    await ctx.db.patch(player._id, {
      isActive: false,
      disconnectedAt: Date.now(),
    });
    await emit(ctx, roomId, "player_leave", {
      playerId: player._id,
      displayName: player.displayName,
    });
    return { ok: true };
  },
});
