import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getGameOrThrow } from "../../src/lib/games";
import type { GameEventOut } from "../../src/lib/games/types";
import {
  ROOM_ENDED_GRACE_MS,
  ROOM_IDLE_EXPIRY_MS,
  TURN_BASE_MS,
  type SeatedPlayer,
} from "../../src/lib/platform/types";
import { createSeed } from "../../src/lib/platform/rng";

/**
 * Engine bridge.
 *
 * The ONLY place the platform talks to a game. It loads serialized state,
 * invokes the pure engine reducers, persists the result, writes the move log
 * and fans out events. Because every game speaks the same `GameEngine` contract,
 * nothing here is game-specific — a new game plugs in with zero changes.
 */

const ROUND_SUMMARY_PAUSE_MS = 6500;

/** Loose shape the platform reads off a game's public projection. */
interface RuntimeSummary {
  currentPlayerId?: string;
  round?: number;
  turnSeq?: number;
  turnDeadline?: number;
}

export async function seatedPlayers(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
): Promise<SeatedPlayer[]> {
  const rows = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  return rows
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({
      playerId: p._id as string,
      displayName: p.displayName,
      seat: p.seat,
      avatar: { color: p.avatarColor, emoji: p.avatarEmoji },
      isActive: p.isActive,
    }));
}

export async function getGameRow(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
): Promise<Doc<"gameState"> | null> {
  return ctx.db
    .query("gameState")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .unique();
}

function summarize(
  engine: ReturnType<typeof getGameOrThrow>,
  state: unknown,
  players: SeatedPlayer[],
): RuntimeSummary {
  const pub = engine.getPublicState(state, players) as RuntimeSummary;
  return {
    currentPlayerId:
      typeof pub?.currentPlayerId === "string" ? pub.currentPlayerId : undefined,
    round: typeof pub?.round === "number" ? pub.round : undefined,
    turnSeq: typeof pub?.turnSeq === "number" ? pub.turnSeq : undefined,
    turnDeadline:
      typeof pub?.turnDeadline === "number" ? pub.turnDeadline : undefined,
  };
}

async function recordEvents(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  events: GameEventOut[],
): Promise<void> {
  if (events.length === 0) return;
  const room = await ctx.db.get(roomId);
  if (!room) return;
  let cursor = room.eventCursor;
  const now = Date.now();
  for (const e of events) {
    await ctx.db.insert("events", {
      roomId,
      seq: cursor,
      type: e.type,
      audience: typeof e.audience === "string" ? e.audience : e.audience.playerId,
      payload: e.payload,
      createdAt: now,
    });
    cursor++;
  }
  await ctx.db.patch(roomId, { eventCursor: cursor });
}

/** Emit a single platform event (player join/leave, pause, etc.). */
export async function emit(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  type: string,
  payload: Record<string, unknown> = {},
  audience: GameEventOut["audience"] = "all",
): Promise<void> {
  await recordEvents(ctx, roomId, [{ type, audience, payload }]);
}

export async function touchRoom(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  patch: Partial<Doc<"rooms">> = {},
): Promise<void> {
  const now = Date.now();
  await ctx.db.patch(roomId, {
    lastActivityAt: now,
    expiresAt: now + ROOM_IDLE_EXPIRY_MS,
    ...patch,
  });
}

/** Persist one engine step + react to its runtime status (round/game end). */
async function commitStep(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  engine: ReturnType<typeof getGameOrThrow>,
  step: { state: unknown; events: GameEventOut[]; status: string },
  players: SeatedPlayer[],
): Promise<void> {
  const now = Date.now();
  const serialized = engine.serializeState(step.state);
  const summary = summarize(engine, step.state, players);
  const existing = await getGameRow(ctx, room._id);

  if (existing) {
    await ctx.db.patch(existing._id, {
      version: existing.version + 1,
      runtimeStatus: step.status,
      state: serialized,
      currentPlayerId: summary.currentPlayerId,
      turnSeq: summary.turnSeq,
      round: summary.round ?? existing.round,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("gameState", {
      roomId: room._id,
      gameId: room.gameType,
      version: 1,
      runtimeStatus: step.status,
      state: serialized,
      currentPlayerId: summary.currentPlayerId,
      turnSeq: summary.turnSeq,
      round: summary.round ?? 0,
      updatedAt: now,
    });
  }

  await recordEvents(ctx, room._id, step.events);

  if (step.status === "game_over") {
    const result = engine.endGame(step.state);
    await ctx.db.patch(room._id, {
      status: "ended",
      endedAt: now,
      result,
      round: summary.round,
      lastActivityAt: now,
      expiresAt: now + ROOM_ENDED_GRACE_MS,
    });
    await ctx.scheduler.runAfter(ROOM_ENDED_GRACE_MS, internal.sessions.autoCloseRoom, {
      roomId: room._id,
    });
  } else if (step.status === "round_over") {
    await touchRoom(ctx, room._id, { round: summary.round });
    await ctx.scheduler.runAfter(
      ROUND_SUMMARY_PAUSE_MS,
      internal.gameplay.resumeAfterRound,
      { roomId: room._id },
    );
  } else {
    await touchRoom(ctx, room._id, { round: summary.round });
    // New turn → arm its timeout (the timeout self-reschedules if the player
    // extends their deadline by acting). Stale timeouts are ignored by seq.
    // When the game declares its own deadline (e.g. a race countdown that can be
    // shorter than a normal turn), arm at that deadline; otherwise use the
    // platform's per-turn base. Backward compatible: turn-based games set
    // turnDeadline = now + TURN_BASE_MS, so the delay is unchanged for them.
    if (summary.turnSeq != null && summary.turnSeq !== existing?.turnSeq) {
      const delay =
        summary.turnDeadline != null
          ? Math.max(0, summary.turnDeadline - now)
          : TURN_BASE_MS;
      await ctx.scheduler.runAfter(delay, internal.gameplay.turnTimeout, {
        roomId: room._id,
        seq: summary.turnSeq,
      });
    }
  }
}

/** Create + start the game for a room (lobby → active). */
export async function launchGame(ctx: MutationCtx, room: Doc<"rooms">): Promise<void> {
  const engine = getGameOrThrow(room.gameType);
  const players = await seatedPlayers(ctx, room._id);
  if (players.length < room.minPlayers) {
    throw new Error(`Need at least ${room.minPlayers} players to start`);
  }
  const now = Date.now();
  const created = engine.createGame({
    players,
    config: room.settings ?? engine.defaultConfig(),
    seed: createSeed(),
    now,
  });
  const step = engine.startGame(created, { players, seed: createSeed(), now });
  await commitStep(ctx, room, engine, step, players);
  await ctx.db.patch(room._id, { status: "active", startedAt: now });
}

/** Validate + apply a player move (server-authoritative). */
export async function applyPlayerMove(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  player: Doc<"players">,
  move: unknown,
): Promise<void> {
  if (room.status !== "active") throw new Error("The game is not accepting moves");
  const engine = getGameOrThrow(room.gameType);
  const row = await getGameRow(ctx, room._id);
  if (!row) throw new Error("The game has not started");

  const state = engine.deserializeState(row.state);
  const players = await seatedPlayers(ctx, room._id);
  const playerId = player._id as string;

  const validation = engine.validateMove(state, playerId, move);
  if (!validation.ok) throw new Error(validation.reason ?? "Illegal move");

  const now = Date.now();
  const step = engine.submitMove(state, playerId, move, {
    players,
    seed: createSeed(),
    now,
  });

  await ctx.db.insert("moves", {
    roomId: room._id,
    playerId: player._id,
    gameId: room.gameType,
    seq: room.moveCursor,
    type: (move as { type?: string }).type ?? "unknown",
    payload: move,
    createdAt: now,
  });
  await ctx.db.patch(room._id, { moveCursor: room.moveCursor + 1 });

  await commitStep(ctx, room, engine, step, players);
}

/** Progress a `round_over` state into the next round (host- or timer-driven). */
export async function resumeRound(ctx: MutationCtx, room: Doc<"rooms">): Promise<void> {
  const engine = getGameOrThrow(room.gameType);
  if (!engine.resume) return;
  if (room.status !== "active") return;
  const row = await getGameRow(ctx, room._id);
  if (!row || row.runtimeStatus !== "round_over") return;

  const state = engine.deserializeState(row.state);
  const players = await seatedPlayers(ctx, room._id);
  const step = engine.resume(state, { players, seed: createSeed(), now: Date.now() });
  await commitStep(ctx, room, engine, step, players);
}

/** A turn's timer fired — auto-resolve it, or reschedule if it was extended. */
export async function runTurnTimeout(
  ctx: MutationCtx,
  room: Doc<"rooms">,
  seq: number,
): Promise<void> {
  if (room.status !== "active") return;
  const engine = getGameOrThrow(room.gameType);
  if (!engine.autoResolveTurn) return;
  const row = await getGameRow(ctx, room._id);
  if (!row || row.runtimeStatus !== "in_progress" || row.turnSeq !== seq) return;

  const state = engine.deserializeState(row.state);
  const players = await seatedPlayers(ctx, room._id);
  const pub = engine.getPublicState(state, players) as {
    currentPlayerId?: string;
    turnDeadline?: number;
  };
  const now = Date.now();

  // The player extended their deadline by acting — wait for the new deadline.
  if (typeof pub.turnDeadline === "number" && now < pub.turnDeadline - 500) {
    await ctx.scheduler.runAfter(
      pub.turnDeadline - now,
      internal.gameplay.turnTimeout,
      { roomId: room._id, seq },
    );
    return;
  }

  if (!pub.currentPlayerId) return;
  const step = engine.autoResolveTurn(state, pub.currentPlayerId, {
    players,
    seed: createSeed(),
    now,
  });
  await commitStep(ctx, room, engine, step, players);
}

/* ----------------------------------------------------- query projections */

export async function publicView(
  ctx: QueryCtx,
  room: Doc<"rooms">,
): Promise<unknown | null> {
  const engine = getGameOrThrow(room.gameType);
  const row = await getGameRow(ctx, room._id);
  if (!row) return null;
  const players = await seatedPlayers(ctx, room._id);
  return engine.getPublicState(engine.deserializeState(row.state), players);
}

export async function privateView(
  ctx: QueryCtx,
  room: Doc<"rooms">,
  playerId: string,
): Promise<unknown | null> {
  const engine = getGameOrThrow(room.gameType);
  const row = await getGameRow(ctx, room._id);
  if (!row) return null;
  const players = await seatedPlayers(ctx, room._id);
  return engine.getPrivateState(engine.deserializeState(row.state), playerId, players);
}
