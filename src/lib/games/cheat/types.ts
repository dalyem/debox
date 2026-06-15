import type { Rank, StandardCard } from "../../cards/standard";
import type { GameRuntimeStatus } from "../types";

/**
 * Cheat / Bullshit — types.
 *
 * 3–8 players. The whole deck is dealt out. Each turn the required rank advances
 * (A, 2, 3, …, K, then loops). On your turn you place 1+ cards face-down — the
 * claim ("two Kings") is fixed to the required rank, but the cards underneath
 * can be anything: you may lie. Anyone may call "Cheat!"; the revealed cards
 * decide who eats the pile. First player to empty their hand wins.
 */

export interface CheatConfig {
  /** Most cards a player may put down in one claim (a claim of 5+ is a tell). */
  maxClaim: number;
}

export interface CheatPlayerState {
  playerId: string;
  seat: number;
  /** Private — never sent to other players. */
  hand: StandardCard[];
}

/** The most recent face-down play — open to challenge until the next play. */
export interface LastPlay {
  playerId: string;
  /** The required rank at the time (what the player is claiming). */
  claimedRank: Rank;
  count: number;
  /** The actual cards, hidden from everyone until revealed by a challenge. */
  cards: StandardCard[];
}

/** Snapshot of a resolved challenge, kept for the dramatic reveal animation. */
export interface ChallengeResult {
  challengerId: string;
  accusedId: string;
  claimedRank: Rank;
  revealed: StandardCard[];
  /** True when the accused was lying. */
  wasBluff: boolean;
  /** Who picked up the pile. */
  loserId: string;
  pileSize: number;
}

export interface CheatTurn {
  seq: number;
  startedAt: number;
  deadline: number;
}

export interface CheatState {
  v: number;
  game: "cheat";
  seed: number;
  config: CheatConfig;
  seatOrder: string[];
  players: Record<string, CheatPlayerState>;
  /** Whose turn it is to PLAY (a challenge can come from anyone else). */
  currentPlayerId: string;
  /** Index into CHEAT_RANK_CYCLE for the current required rank. */
  requiredRankIndex: number;
  /** Face-down center pile (hidden). */
  pile: StandardCard[];
  lastPlay: LastPlay | null;
  lastChallenge: ChallengeResult | null;
  turn: CheatTurn;
  winnerId: string | null;
  status: GameRuntimeStatus;
}

/* ---- Moves ------------------------------------------------------------- */

export interface CheatPlayMove {
  type: "play";
  cardIds: string[];
}

export interface CheatChallengeMove {
  type: "challenge";
}

export type CheatMove = CheatPlayMove | CheatChallengeMove;

/* ---- Audience-safe projections ----------------------------------------- */

export interface PublicCheatPlayer {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  seat: number;
  handCount: number;
  isActive: boolean;
  isCurrent: boolean;
}

export interface PublicClaim {
  playerId: string;
  claimedRank: Rank;
  claimedRankLabel: string;
  count: number;
}

export interface PublicCheatView {
  game: "cheat";
  status: GameRuntimeStatus;
  currentPlayerId: string;
  requiredRank: Rank;
  requiredRankLabel: string;
  players: PublicCheatPlayer[];
  pileSize: number;
  lastClaim: PublicClaim | null;
  canBeChallenged: boolean;
  lastChallenge: ChallengeResult | null;
  winnerId: string | null;
  /** Platform turn bookkeeping. */
  round: number;
  turnDeadline: number;
  turnSeq: number;
}

export interface PrivateCheatView {
  game: "cheat";
  status: GameRuntimeStatus;
  you: {
    playerId: string;
    /** Sorted by rank then suit so the controller can group by rank. */
    hand: StandardCard[];
  };
  isYourTurn: boolean;
  requiredRank: Rank;
  requiredRankLabel: string;
  turnDeadline: number;
  actions: {
    canPlay: boolean;
    minClaim: number;
    maxClaim: number;
    canChallenge: boolean;
  };
  lastClaim: PublicClaim | null;
  lastChallenge: ChallengeResult | null;
  winnerId: string | null;
  table: PublicCheatView;
}
