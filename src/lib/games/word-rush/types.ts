import type { GameRuntimeStatus } from "../types";

/**
 * Word Rush — types.
 *
 * A party race on the classic 5-letter / 6-guess word puzzle. Everyone gets the
 * SAME secret word at the same time and races to crack it. The instant the first
 * player "locks in" (solves OR burns all six guesses) a shared countdown starts
 * for everyone still playing — and every further lock-in shaves time off it, so
 * the field tightens as people finish. Points reward speed (finish order) and
 * accuracy (fewer guesses); failing the word costs points; running out of time
 * with guesses to spare scores nothing. First to the target score (default 50)
 * wins, otherwise the highest score after the final round takes it.
 */

/** A single tile's result, mirroring Wordle's green / yellow / grey. */
export type TileState = "correct" | "present" | "absent";

/** A player's standing within the current round. */
export type PlayerRoundStatus = "playing" | "solved" | "failed" | "timed_out";

/** Internal phase; the platform's runtime status is derived from this. */
export type WordRushPhase = "racing" | "round_over" | "game_over";

export interface WordRushConfig {
  /** Letters per word (classic Wordle = 5). */
  wordLength: number;
  /** Guesses allowed before a player fails the word (classic = 6). */
  maxGuesses: number;
  /** Cumulative score that wins the match outright. */
  targetScore: number;
  /** Hard cap on rounds; the match ends here even if no one hit the target. */
  maxRounds: number;
  /** Require guesses to be real dictionary words. */
  strictDictionary: boolean;
  /** Base lock-in countdown (ms) for a 2-player match. */
  lockBaseMs: number;
  /** Extra countdown (ms) added per player beyond the second. */
  lockPerExtraPlayerMs: number;
  /** Time (ms) shaved off the countdown on each lock-in after the first. */
  lockStepMs: number;
  /** Floor (ms) the shrinking countdown can never drop below in one step. */
  lockMinTailMs: number;
  /** Points deducted for failing the word (uses all guesses). Negative. */
  failPenalty: number;
}

/** One submitted guess: the word plus its evaluated tile pattern. */
export interface WordRushGuess {
  /** UPPERCASE, exactly `wordLength` letters. */
  word: string;
  pattern: TileState[];
}

export interface WordRushPlayerState {
  playerId: string;
  seat: number;
  /** Cumulative score across rounds. */
  totalScore: number;
  /** Guesses made this round (oldest first). */
  guesses: WordRushGuess[];
  status: PlayerRoundStatus;
  /** When this player reached a terminal round status. */
  finishedAt: number | null;
  /** When this player solved (null unless solved). */
  solvedAt: number | null;
  /** Points earned in the current / most recent round. */
  roundScore: number;
  /** 1-based finish position among solvers this round (null unless solved). */
  placement: number | null;
}

export interface WordRushState {
  v: number;
  game: "word-rush";
  seed: number;
  config: WordRushConfig;
  /** 1-based current round (0 before the first deal). */
  round: number;
  phase: WordRushPhase;
  /** UPPERCASE secret answer — never projected to clients while racing. */
  answer: string;
  seatOrder: string[];
  players: Record<string, WordRushPlayerState>;
  roundStartedAt: number;
  /** Shared countdown deadline; null until the first player locks in. */
  lockDeadline: number | null;
  /** Monotonic counter; bumped whenever the countdown is (re)armed. */
  lockSeq: number;
  /** Solver ids in the order they cracked the word this round. */
  finishOrder: string[];
  /** Lowercase answers already used this match (avoids repeats). */
  usedWords: string[];
  lastSummary: WordRushRoundSummary | null;
}

/* ---- Moves ------------------------------------------------------------- */

export interface GuessMove {
  type: "guess";
  word: string;
}

export type WordRushMove = GuessMove;

/* ---- Round summary ----------------------------------------------------- */

export interface WordRushRoundResult {
  playerId: string;
  status: PlayerRoundStatus;
  guesses: number;
  placement: number | null;
  roundScore: number;
  totalScore: number;
}

export interface WordRushRoundSummary {
  round: number;
  /** The answer, revealed once the round is over. */
  answer: string;
  results: WordRushRoundResult[];
}

/* ---- Audience-safe projections ----------------------------------------- */

/** One player's board as shown on the shared TV — patterns only, no letters. */
export interface PublicBoard {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  seat: number;
  totalScore: number;
  /** Per-guess colour patterns (letters are intentionally withheld). */
  rows: TileState[][];
  guessesUsed: number;
  status: PlayerRoundStatus;
  placement: number | null;
  roundScore: number;
  isActive: boolean;
}

export interface PublicWordRushView {
  game: "word-rush";
  status: GameRuntimeStatus;
  phase: WordRushPhase;
  round: number;
  maxRounds: number;
  targetScore: number;
  wordLength: number;
  maxGuesses: number;
  boards: PublicBoard[];
  /** Shared countdown end (ms) while active, else null. */
  countdownDeadline: number | null;
  /** The answer, revealed only once the round is over. */
  reveal: string | null;
  lastSummary: WordRushRoundSummary | null;
  /* Platform timer hooks (read by the engine bridge). */
  currentPlayerId?: string;
  turnSeq?: number;
  turnDeadline?: number;
}

export interface ScoreboardEntry {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  totalScore: number;
  status: PlayerRoundStatus;
}

export interface PrivateWordRushView {
  game: "word-rush";
  status: GameRuntimeStatus;
  phase: WordRushPhase;
  round: number;
  maxRounds: number;
  targetScore: number;
  wordLength: number;
  maxGuesses: number;
  you: {
    /** Your own guesses, with letters AND colours. */
    rows: WordRushGuess[];
    guessesUsed: number;
    guessesLeft: number;
    status: PlayerRoundStatus;
    roundScore: number;
    totalScore: number;
    placement: number | null;
    /** Best-known status per letter for the on-screen keyboard. */
    keyboard: Record<string, TileState>;
  };
  /** True while you may still submit a guess. */
  canGuess: boolean;
  countdownDeadline: number | null;
  reveal: string | null;
  /* Base-view contract (the generic controller reads these). */
  isYourTurn: boolean;
  turnDeadline: number;
  scoreboard: ScoreboardEntry[];
}
