import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Debox data model.
 *
 * The schema is game-agnostic: `rooms`, `players`, `events`, `moves` and
 * `gameState` describe the *platform*. A game's authoritative state is stored
 * as a serialized blob in `gameState.state`, so adding a new game never changes
 * this schema. `games` is a catalog mirror of the in-code game registry.
 */

export const roomStatusValidator = v.union(
  v.literal("pending"),
  v.literal("lobby"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("ended"),
  v.literal("closed"),
  v.literal("expired"),
);

export default defineSchema({
  /** Authenticated hosts (Clerk-backed). Players are NOT users. */
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_clerk", ["clerkId"]),

  /** A single game session. Codes are unique among non-terminal rooms. */
  rooms: defineTable({
    hostId: v.id("users"),
    hostClerkId: v.string(),
    roomCode: v.string(),
    shareUrl: v.string(),
    gameType: v.string(),
    status: roomStatusValidator,
    // "tv" = host runs a shared screen (not a player); "player" = host plays on
    // their phone with no shared screen. Optional for back-compat; defaults "tv".
    hostMode: v.optional(v.union(v.literal("tv"), v.literal("player"))),
    settings: v.optional(v.any()),
    maxPlayers: v.number(),
    minPlayers: v.number(),
    // Denormalized for cheap reads on the TV / dashboard.
    round: v.optional(v.number()),
    result: v.optional(v.any()),
    // Monotonic cursors so events/moves get a stable order without extra reads.
    eventCursor: v.number(),
    moveCursor: v.number(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    expiresAt: v.number(),
    lastActivityAt: v.number(),
  })
    .index("by_code", ["roomCode"])
    .index("by_host", ["hostClerkId"])
    .index("by_status_expiry", ["status", "expiresAt"]),

  /** Anonymous guest players. Authenticated by a hashed, signed session token. */
  players: defineTable({
    roomId: v.id("rooms"),
    displayName: v.string(),
    guestTokenHash: v.string(),
    avatarColor: v.string(),
    avatarEmoji: v.string(),
    seat: v.number(),
    isActive: v.boolean(),
    /** True for the host's own player row in "player" mode. */
    isHost: v.optional(v.boolean()),
    joinedAt: v.number(),
    lastSeenAt: v.number(),
    disconnectedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_seat", ["roomId", "seat"])
    .index("by_token", ["guestTokenHash"])
    .index("by_room_token", ["roomId", "guestTokenHash"]),

  /** Catalog of installed games, mirrored from the in-code registry. */
  games: defineTable({
    gameId: v.string(),
    name: v.string(),
    tagline: v.string(),
    description: v.string(),
    minPlayers: v.number(),
    maxPlayers: v.number(),
    estimatedMinutes: v.number(),
    accent: v.string(),
    emoji: v.string(),
    enabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_gameId", ["gameId"]),

  /** Authoritative, serialized game state — one row per room. */
  gameState: defineTable({
    roomId: v.id("rooms"),
    gameId: v.string(),
    version: v.number(),
    /** GameRuntimeStatus: "in_progress" | "round_over" | "game_over". */
    runtimeStatus: v.string(),
    /** Engine-serialized state (JSON string). Never sent raw to clients. */
    state: v.string(),
    currentPlayerId: v.optional(v.string()),
    /** Monotonic turn id — used to schedule/expire per-turn timers. */
    turnSeq: v.optional(v.number()),
    round: v.number(),
    updatedAt: v.number(),
  }).index("by_room", ["roomId"]),

  /** Append-only audit/replay log of player moves. */
  moves: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    gameId: v.string(),
    seq: v.number(),
    type: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_seq", ["roomId", "seq"]),

  /** Event feed driving TV + controller animations/notifications. */
  events: defineTable({
    roomId: v.id("rooms"),
    seq: v.number(),
    type: v.string(),
    /** "tv" | "all" | a playerId string. */
    audience: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_seq", ["roomId", "seq"]),
});
