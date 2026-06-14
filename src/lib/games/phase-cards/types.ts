import type { Card } from "../../cards/types";
import type { GroupType } from "../../cards/validate";
import type { GameRuntimeStatus } from "../types";

/** A group a player has laid on the table (face-up, public). */
export interface LaidGroup {
  type: GroupType;
  count: number;
  label: string;
  cards: Card[];
  /** For runs: the locked consecutive value window the run occupies. */
  lo?: number;
  hi?: number;
}

export interface PhaseCardsPlayer {
  playerId: string;
  hand: Card[];
  /** 1-based phase the player is currently trying to complete. >10 = finished. */
  phaseIndex: number;
  /** Has the player laid down their phase this round? */
  completedPhase: boolean;
  /** Groups laid this round (their phase melds). */
  laidGroups: LaidGroup[];
  /** Cumulative penalty points (lower is better). */
  score: number;
  /** True once the player clears phase 10. */
  finishedLadder: boolean;
}

export interface RoundPlayerSummary {
  playerId: string;
  advanced: boolean;
  phaseBefore: number;
  phaseAfter: number;
  pointsAdded: number;
  totalScore: number;
  wentOut: boolean;
}

export interface RoundSummary {
  round: number;
  wentOutPlayerId: string | null;
  players: RoundPlayerSummary[];
}

export interface PhaseCardsConfig {
  /** Reserved for future toggles (e.g. house rules). */
  recycleDiscard: boolean;
}

export interface PhaseCardsTurn {
  currentPlayerId: string;
  direction: 1 | -1;
  /** playerId -> queued skips. */
  pendingSkips: Record<string, number>;
  /** Must draw before laying down / discarding. */
  hasDrawn: boolean;
  /** Snapshot of where the turn's drawn card came from (for the event feed). */
  drewFrom: "draw" | "discard" | null;
  /** Monotonic id for this turn — used to expire stale turn timers. */
  seq: number;
  /** Timestamp the turn began. */
  startedAt: number;
  /** Timestamp the turn auto-resolves if the player hasn't acted. */
  deadline: number;
}

export interface PhaseCardsState {
  /** State schema version for migrations. */
  v: number;
  game: "phase-cards";
  seed: number;
  round: number;
  status: GameRuntimeStatus;
  turn: PhaseCardsTurn;
  drawPile: Card[];
  /** Top of pile = last element. */
  discardPile: Card[];
  seatOrder: string[];
  players: Record<string, PhaseCardsPlayer>;
  lastRoundSummary: RoundSummary | null;
  /** Set once the game is over. */
  winnerIds: string[];
  startedAt: number | null;
  /** Player ids already frozen (skipped) this round — one Skip per player/round. */
  skippedThisRound: string[];
}

/* ---- Moves a controller can submit ------------------------------------- */

export interface DrawMove {
  type: "draw";
  source: "draw" | "discard";
}

export interface LayDownMove {
  type: "layDown";
  /** Card ids per requirement slot, aligned to the player's phase. */
  groups: string[][];
}

export interface HitMove {
  type: "hit";
  targetPlayerId: string;
  groupIndex: number;
  cardId: string;
}

export interface DiscardMove {
  type: "discard";
  cardId: string;
  /** Required when discarding a Freeze: who gets skipped. */
  skipTargetPlayerId?: string;
}

export type PhaseCardsMove = DrawMove | LayDownMove | HitMove | DiscardMove;

/* ---- Audience-safe projections ----------------------------------------- */

export interface PublicPlayerView {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  seat: number;
  phaseIndex: number;
  phaseName: string;
  handCount: number;
  completedPhase: boolean;
  laidGroups: LaidGroup[];
  score: number;
  finishedLadder: boolean;
  isActive: boolean;
}

export interface PublicGameView {
  game: "phase-cards";
  round: number;
  status: GameRuntimeStatus;
  currentPlayerId: string;
  direction: 1 | -1;
  discardTop: Card | null;
  drawCount: number;
  discardCount: number;
  players: PublicPlayerView[];
  lastRoundSummary: RoundSummary | null;
  winnerIds: string[];
  /** Current turn's auto-resolve deadline + id (for timers + the scheduler). */
  turnDeadline: number;
  turnSeq: number;
}

export interface PrivateGameView {
  game: "phase-cards";
  you: {
    playerId: string;
    hand: Card[];
    phaseIndex: number;
    phaseName: string;
    phaseBlurb: string;
    requirements: { type: GroupType; count: number; label: string }[];
    completedPhase: boolean;
    laidGroups: LaidGroup[];
    score: number;
    finishedLadder: boolean;
  };
  isYourTurn: boolean;
  currentPlayerId: string;
  hasDrawn: boolean;
  /** Current turn's auto-resolve deadline (ms epoch) for the countdown timer. */
  turnDeadline: number;
  /** Allowed action flags for quick UI gating. */
  actions: {
    canDraw: boolean;
    canDrawFromDiscard: boolean;
    canLayDown: boolean;
    canHit: boolean;
    mustDiscard: boolean;
  };
  discardTop: Card | null;
  drawCount: number;
  round: number;
  status: GameRuntimeStatus;
  /** Public table info so the controller can show opponents + targets. */
  table: PublicPlayerView[];
  /** Player ids already frozen this round (can't be targeted by a Skip again). */
  frozenThisRound: string[];
}
