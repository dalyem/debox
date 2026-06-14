import type { SeatedPlayer } from "../platform/types";

/**
 * Game Plugin System — the contract every Debox game implements.
 *
 * A game is a *pure state machine*. It never touches the database, Convex, the
 * network or the clock directly. The platform (Convex functions) owns all I/O:
 * it loads serialized state, calls the engine's pure reducers, persists the new
 * state, and fans out the returned events. This keeps games:
 *   • server-authoritative (all validation runs in Convex),
 *   • deterministic + replayable (randomness comes from an injected seed),
 *   • trivially unit-testable (no mocks required),
 *   • decoupled (a new game requires zero changes to the room system).
 */

/** Static catalog metadata shown in the dashboard + lobby. */
export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedMinutes: number;
  /** Design-token accent key driving the game's themed UI. */
  accent: string;
  emoji: string;
}

/** Outbound event the platform records + animates (TV / controllers). */
export interface GameEventOut {
  type: string;
  audience: "tv" | "all" | { playerId: string };
  payload: Record<string, unknown>;
}

export interface MoveValidation {
  ok: boolean;
  reason?: string;
}

export type GameRuntimeStatus = "in_progress" | "round_over" | "game_over";

export interface GameStepResult<State> {
  state: State;
  events: GameEventOut[];
  status: GameRuntimeStatus;
}

/** Non-deterministic inputs injected by the platform at call time. */
export interface GameContext {
  players: SeatedPlayer[];
  /** Deterministic seed for any shuffle/deal performed in this step. */
  seed: number;
  /** Wall-clock timestamp (ms) recorded by the calling mutation. */
  now: number;
}

export interface GameStanding {
  playerId: string;
  rank: number;
  score: number;
  /** Free-form progress label, e.g. current phase. */
  progress?: number;
  detail?: string;
}

export interface GameResult {
  winners: string[];
  standings: GameStanding[];
}

/**
 * The plugin interface. Type parameters: serialized game `State`, the `Move`
 * union players submit, and per-game `Config`.
 *
 * Method names intentionally mirror the platform's vocabulary:
 *   createGame / joinGame / startGame / submitMove / validateMove /
 *   advanceTurn / endGame / getPublicState / getPrivateState /
 *   serializeState / deserializeState.
 */
export interface GameEngine<State = unknown, Move = unknown, Config = unknown> {
  readonly meta: GameMeta;

  /** Default room settings offered when a host creates the game. */
  defaultConfig(): Config;

  /** Initialize lobby-phase state for a room (before the game starts). */
  createGame(input: {
    players: SeatedPlayer[];
    config: Config;
    seed: number;
    now: number;
  }): State;

  /** Register a player who joined the lobby into game state. */
  joinGame(state: State, player: SeatedPlayer): State;

  /** Begin play: deal, set turn order, emit launch events. */
  startGame(state: State, ctx: GameContext): GameStepResult<State>;

  /** Pure, side-effect-free legality check used before applying a move. */
  validateMove(state: State, playerId: string, move: Move): MoveValidation;

  /** Validate + apply a move, advancing turn/round as needed, emitting events. */
  submitMove(
    state: State,
    playerId: string,
    move: Move,
    ctx: GameContext,
  ): GameStepResult<State>;

  /** Advance to the next player's turn (also used to recover a stalled turn). */
  advanceTurn(state: State, ctx: GameContext): State;

  /**
   * Optional: progress an auto-paced state. The platform calls this (never a
   * player) when a step returns `round_over`, after a short summary pause, to
   * deal the next round. Games without paced transitions can omit it.
   */
  resume?(state: State, ctx: GameContext): GameStepResult<State>;

  /** Finalize the game and compute standings/winners. */
  endGame(state: State): GameResult;

  /** Audience-safe projection for the shared TV display. */
  getPublicState(state: State, players: SeatedPlayer[]): unknown;

  /** Private projection for a single player's controller (their hand only). */
  getPrivateState(state: State, playerId: string, players: SeatedPlayer[]): unknown;

  /** Persisted form written to the `gameState` table. */
  serializeState(state: State): string;

  /** Hydrate persisted state from storage. */
  deserializeState(raw: string): State;
}
