import type { StandardCard, Suit } from "../../cards/standard";
import type { GameRuntimeStatus } from "../types";

/**
 * Spades — types.
 *
 * Partnership trick-taking for exactly four players. Fixed teams: seats 0 & 2
 * vs seats 1 & 3. Standard 52-card deck, 13 cards each, spades are permanent
 * trump. Each round is bid → play 13 tricks → score; first team to the target
 * score (default 500) wins.
 */

export type TeamId = 0 | 1;

/** Internal game phase. The platform's runtime status is derived from this. */
export type SpadesPhase = "bidding" | "playing" | "round_over" | "game_over";

export interface SpadesConfig {
  /** Cumulative score that wins the game. */
  targetScore: number;
  /** Allow a bid of 0 to mean "nil" (take no tricks for a bonus). */
  allowNil: boolean;
  /** Points for a made/failed nil. */
  nilValue: number;
  /** Penalty subtracted each time a team accumulates another 10 bags. */
  bagPenalty: number;
}

export interface SpadesPlayerState {
  playerId: string;
  seat: number;
  team: TeamId;
  /** Private — never sent to other players. */
  hand: StandardCard[];
  /** Null until the player bids. 0 = nil when `allowNil`. */
  bid: number | null;
  /** Tricks taken this round. */
  tricksWon: number;
}

export interface PlayedCard {
  playerId: string;
  card: StandardCard;
}

/** The trick currently on the table (face-up — public knowledge). */
export interface SpadesTrick {
  leaderId: string;
  ledSuit: Suit | null;
  plays: PlayedCard[];
}

export interface SpadesTeamState {
  team: TeamId;
  score: number;
  /** Cumulative bags taken (overtricks). Penalty applies every 10. */
  bags: number;
}

/* ---- Round summary ----------------------------------------------------- */

export interface NilOutcome {
  playerId: string;
  made: boolean;
}

export interface TeamRoundSummary {
  team: TeamId;
  bid: number;
  tricks: number;
  madeContract: boolean;
  contractDelta: number;
  bagsThisRound: number;
  bagPenalty: number;
  nilDelta: number;
  roundDelta: number;
  scoreBefore: number;
  scoreAfter: number;
  nil: NilOutcome[];
}

export interface SpadesRoundSummary {
  round: number;
  teams: TeamRoundSummary[];
}

/* ---- Turn bookkeeping (drives the platform's per-turn timer) ----------- */

export interface SpadesTurn {
  currentPlayerId: string;
  /** Monotonic id used to expire stale turn timers. */
  seq: number;
  startedAt: number;
  deadline: number;
}

export interface SpadesState {
  v: number;
  game: "spades";
  seed: number;
  round: number;
  phase: SpadesPhase;
  config: SpadesConfig;
  /** Seat that opens bidding + leads trick 1 this round (rotates each round). */
  firstSeat: number;
  seatOrder: string[];
  players: Record<string, SpadesPlayerState>;
  teams: [SpadesTeamState, SpadesTeamState];
  trick: SpadesTrick;
  /** Completed tricks this round (kept for "tricks won" display + replay). */
  completedTricks: number;
  spadesBroken: boolean;
  turn: SpadesTurn;
  lastTrickWinnerId: string | null;
  lastRoundSummary: SpadesRoundSummary | null;
  winnerTeam: TeamId | null;
}

/* ---- Moves ------------------------------------------------------------- */

export interface BidMove {
  type: "bid";
  bid: number;
}

export interface PlayMove {
  type: "play";
  cardId: string;
}

export type SpadesMove = BidMove | PlayMove;

/* ---- Audience-safe projections ----------------------------------------- */

export interface PublicSpadesPlayer {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  seat: number;
  team: TeamId;
  bid: number | null;
  tricksWon: number;
  handCount: number;
  isActive: boolean;
}

export interface PublicTeam {
  team: TeamId;
  score: number;
  bags: number;
  /** Combined bid this round (null until both partners have bid). */
  bid: number | null;
  /** Combined tricks taken this round. */
  tricks: number;
}

export interface PublicSpadesView {
  game: "spades";
  status: GameRuntimeStatus;
  phase: SpadesPhase;
  round: number;
  currentPlayerId: string;
  players: PublicSpadesPlayer[];
  teams: [PublicTeam, PublicTeam];
  trick: SpadesTrick;
  spadesBroken: boolean;
  completedTricks: number;
  lastTrickWinnerId: string | null;
  lastRoundSummary: SpadesRoundSummary | null;
  winnerTeam: TeamId | null;
  targetScore: number;
  turnDeadline: number;
  turnSeq: number;
}

export interface PrivateSpadesView {
  game: "spades";
  status: GameRuntimeStatus;
  phase: SpadesPhase;
  you: {
    playerId: string;
    seat: number;
    team: TeamId;
    hand: StandardCard[];
    bid: number | null;
    tricksWon: number;
  };
  isYourTurn: boolean;
  turnDeadline: number;
  /** Bidding: allowed bid range. Playing: ids of cards you may legally play. */
  actions: {
    canBid: boolean;
    minBid: number;
    maxBid: number;
    allowNil: boolean;
    canPlay: boolean;
    playableCardIds: string[];
  };
  /** Embedded public table so the controller can show the trick + scores. */
  table: PublicSpadesView;
}
