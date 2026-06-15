import { type SeatedPlayer } from "../../platform/types";
import { makeRng } from "../../platform/rng";
import { evaluateGuess, isAllCorrect, mergeKeyboard } from "./feedback";
import { lockWindowMs, solveScore } from "./scoring";
import { WORD_LENGTH, isValidGuess, normalizeGuess, pickAnswer } from "./words";
import type {
  GameEngine,
  GameEventOut,
  GameMeta,
  GameResult,
  GameRuntimeStatus,
  GameStanding,
  GameStepResult,
  MoveValidation,
} from "../types";
import type {
  PrivateWordRushView,
  PublicBoard,
  PublicWordRushView,
  ScoreboardEntry,
  TileState,
  WordRushConfig,
  WordRushMove,
  WordRushPhase,
  WordRushPlayerState,
  WordRushRoundResult,
  WordRushRoundSummary,
  WordRushState,
} from "./types";

const META: GameMeta = {
  id: "word-rush",
  name: "Word Rush",
  tagline: "Same word. Everyone races. Fastest mind wins.",
  description:
    "A party race on the daily word puzzle. Everyone gets the SAME hidden 5-letter word and six guesses — crack it fast and clean for points. The moment someone locks in, a shared clock starts for everyone else, and it gets shorter every time another player finishes. First to 50 wins.",
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: 8,
  accent: "lime",
  emoji: "🟩",
};

/* ------------------------------------------------------------------ utils */

function getP(state: WordRushState, id: string): WordRushPlayerState {
  const p = state.players[id];
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

function runtimeStatusOf(phase: WordRushPhase): GameRuntimeStatus {
  if (phase === "game_over") return "game_over";
  if (phase === "round_over") return "round_over";
  return "in_progress";
}

function freshPlayerRound(prev: WordRushPlayerState): WordRushPlayerState {
  return {
    ...prev,
    guesses: [],
    status: "playing",
    finishedAt: null,
    solvedAt: null,
    roundScore: 0,
    placement: null,
  };
}

/** Ids still racing (haven't solved / failed / timed out). */
function stillPlaying(state: WordRushState): string[] {
  return state.seatOrder.filter((id) => getP(state, id).status === "playing");
}

/** Per-round RNG so each word is reproducible from (seed, round). */
function roundRng(seed: number, round: number) {
  return makeRng((seed ^ (round * 0x9e3779b1)) >>> 0);
}

/* --------------------------------------------------------------- dealing */

function dealRound(
  state: WordRushState,
  round: number,
  now: number,
): GameStepResult<WordRushState> {
  const answer = pickAnswer(roundRng(state.seed, round), state.usedWords);
  const players: Record<string, WordRushPlayerState> = {};
  for (const id of state.seatOrder) players[id] = freshPlayerRound(getP(state, id));

  const next: WordRushState = {
    ...state,
    round,
    phase: "racing",
    answer,
    players,
    roundStartedAt: now,
    lockDeadline: null,
    finishOrder: [],
    usedWords: [...state.usedWords, answer.toLowerCase()],
  };

  return {
    state: next,
    events: [
      { type: "wr_round_start", audience: "all", payload: { round } },
    ],
    status: "in_progress",
  };
}

/* --------------------------------------------------------- round scoring */

function buildSummary(state: WordRushState): WordRushRoundSummary {
  const results: WordRushRoundResult[] = state.seatOrder.map((id) => {
    const p = getP(state, id);
    return {
      playerId: id,
      status: p.status,
      guesses: p.guesses.length,
      placement: p.placement,
      roundScore: p.roundScore,
      totalScore: p.totalScore,
    };
  });
  return { round: state.round, answer: state.answer, results };
}

/**
 * Close out the round: anyone still racing is timed out for zero, then we
 * decide whether the match is over (someone hit the target, or we've played the
 * final round) or a new word should be dealt after the summary pause.
 */
function endRound(
  state: WordRushState,
  priorEvents: GameEventOut[],
  now: number,
): GameStepResult<WordRushState> {
  const players: Record<string, WordRushPlayerState> = { ...state.players };
  for (const id of state.seatOrder) {
    if (players[id]!.status === "playing") {
      players[id] = {
        ...players[id]!,
        status: "timed_out",
        finishedAt: now,
        roundScore: 0,
        placement: null,
      };
    }
  }

  const settled: WordRushState = { ...state, players, lockDeadline: null };
  const summary = buildSummary(settled);

  const hitTarget = state.seatOrder.some(
    (id) => players[id]!.totalScore >= state.config.targetScore,
  );
  const lastRound = state.round >= state.config.maxRounds;
  const over = hitTarget || lastRound;
  const phase: WordRushPhase = over ? "game_over" : "round_over";

  const events: GameEventOut[] = [
    ...priorEvents,
    {
      type: "wr_round_end",
      audience: "all",
      payload: { round: state.round, answer: state.answer, summary },
    },
  ];
  if (over) {
    events.push({ type: "wr_game_over", audience: "all", payload: {} });
  }

  return {
    state: { ...settled, phase, lastSummary: summary },
    events,
    status: over ? "game_over" : "round_over",
  };
}

/* --------------------------------------------------------- move handlers */

function applyGuess(
  state: WordRushState,
  playerId: string,
  rawWord: string,
  now: number,
): GameStepResult<WordRushState> {
  const p = getP(state, playerId);
  const word = normalizeGuess(rawWord).toUpperCase();
  const pattern = evaluateGuess(word, state.answer);
  const guesses = [...p.guesses, { word, pattern }];
  const solved = isAllCorrect(pattern);
  const failed = !solved && guesses.length >= state.config.maxGuesses;

  const events: GameEventOut[] = [];
  let finishOrder = state.finishOrder;
  let updated: WordRushPlayerState = { ...p, guesses };

  if (solved) {
    finishOrder = [...finishOrder, playerId];
    const placement = finishOrder.length;
    const score = solveScore(guesses.length, placement, state.config);
    updated = {
      ...updated,
      status: "solved",
      finishedAt: now,
      solvedAt: now,
      placement,
      roundScore: score,
      totalScore: p.totalScore + score,
    };
    events.push({
      type: "wr_solved",
      audience: "all",
      payload: { playerId, placement, guesses: guesses.length, score },
    });
  } else if (failed) {
    const score = state.config.failPenalty;
    updated = {
      ...updated,
      status: "failed",
      finishedAt: now,
      placement: null,
      roundScore: score,
      totalScore: p.totalScore + score,
    };
    events.push({ type: "wr_failed", audience: "all", payload: { playerId } });
  }

  let working: WordRushState = {
    ...state,
    players: { ...state.players, [playerId]: updated },
    finishOrder,
  };

  // A non-finishing guess just advances this player's board; round continues.
  if (!solved && !failed) {
    return { state: working, events, status: "in_progress" };
  }

  // This player locked in. If everyone is now finished, end the round.
  if (stillPlaying(working).length === 0) {
    return endRound(working, events, now);
  }

  // Others remain: start the shared clock, or ratchet it down on each lock-in.
  if (working.lockDeadline == null) {
    const windowMs = lockWindowMs(working.seatOrder.length, working.config);
    const deadline = now + windowMs;
    working = { ...working, lockDeadline: deadline, lockSeq: working.lockSeq + 1 };
    events.push({
      type: "wr_lock_start",
      audience: "all",
      payload: { playerId, deadline, windowMs },
    });
  } else {
    const deadline = Math.max(
      now + working.config.lockMinTailMs,
      working.lockDeadline - working.config.lockStepMs,
    );
    working = { ...working, lockDeadline: deadline, lockSeq: working.lockSeq + 1 };
    events.push({
      type: "wr_lock_shorten",
      audience: "all",
      payload: { playerId, deadline, byMs: working.config.lockStepMs },
    });
  }

  return { state: working, events, status: "in_progress" };
}

/* ----------------------------------------------------------- validation */

function validate(
  state: WordRushState,
  playerId: string,
  move: WordRushMove,
): MoveValidation {
  if (state.phase !== "racing") {
    return { ok: false, reason: "The round isn't open right now" };
  }
  const p = state.players[playerId];
  if (!p) return { ok: false, reason: "You're not in this game" };
  if (p.status !== "playing") {
    if (p.status === "solved") return { ok: false, reason: "You already cracked it!" };
    if (p.status === "failed") return { ok: false, reason: "You're out of guesses" };
    return { ok: false, reason: "Time's up for this round" };
  }
  if (!move || move.type !== "guess") return { ok: false, reason: "Unknown move" };

  const word = normalizeGuess(String(move.word ?? ""));
  if (word.length !== state.config.wordLength) {
    return { ok: false, reason: `Guess must be ${state.config.wordLength} letters` };
  }
  if (!/^[a-z]+$/.test(word)) return { ok: false, reason: "Letters only" };
  if (p.guesses.length >= state.config.maxGuesses) {
    return { ok: false, reason: "No guesses left" };
  }
  if (state.config.strictDictionary && !isValidGuess(word)) {
    return { ok: false, reason: "Not in the word list" };
  }
  return { ok: true };
}

/* --------------------------------------------------------- projections */

function avatarOf(p: SeatedPlayer | undefined) {
  return p?.avatar ?? { color: "slate", emoji: "🙂" };
}

function countdownActive(state: WordRushState): boolean {
  return (
    state.phase === "racing" &&
    state.lockDeadline != null &&
    stillPlaying(state).length > 0
  );
}

function publicBoards(
  state: WordRushState,
  players: SeatedPlayer[],
): PublicBoard[] {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  return state.seatOrder.map((id) => {
    const p = getP(state, id);
    const sp = byId.get(id);
    return {
      playerId: id,
      displayName: sp?.displayName ?? "Player",
      avatar: avatarOf(sp),
      seat: p.seat,
      totalScore: p.totalScore,
      rows: p.guesses.map((g) => g.pattern),
      guessesUsed: p.guesses.length,
      status: p.status,
      placement: p.placement,
      roundScore: p.roundScore,
      isActive: sp?.isActive ?? false,
    };
  });
}

function buildPublicView(
  state: WordRushState,
  players: SeatedPlayer[],
): PublicWordRushView {
  const active = countdownActive(state);
  const waitingOn = active ? stillPlaying(state)[0] : undefined;
  return {
    game: "word-rush",
    status: runtimeStatusOf(state.phase),
    phase: state.phase,
    round: state.round,
    maxRounds: state.config.maxRounds,
    targetScore: state.config.targetScore,
    wordLength: state.config.wordLength,
    maxGuesses: state.config.maxGuesses,
    boards: publicBoards(state, players),
    countdownDeadline: active ? state.lockDeadline : null,
    reveal: state.phase === "racing" ? null : state.answer,
    lastSummary: state.lastSummary,
    // Platform timer hooks — only "armed" while the shared clock is running.
    currentPlayerId: waitingOn,
    turnSeq: active ? state.lockSeq : undefined,
    turnDeadline: active ? state.lockDeadline! : undefined,
  };
}

function scoreboard(
  state: WordRushState,
  players: SeatedPlayer[],
): ScoreboardEntry[] {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  return state.seatOrder
    .map((id) => {
      const p = getP(state, id);
      const sp = byId.get(id);
      return {
        playerId: id,
        displayName: sp?.displayName ?? "Player",
        avatar: avatarOf(sp),
        totalScore: p.totalScore,
        status: p.status,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

/* --------------------------------------------------------------- engine */

export const WordRushEngine: GameEngine<
  WordRushState,
  WordRushMove,
  WordRushConfig
> = {
  meta: META,

  defaultConfig() {
    return {
      wordLength: WORD_LENGTH,
      maxGuesses: 6,
      targetScore: 50,
      maxRounds: 5,
      strictDictionary: true,
      lockBaseMs: 1000 * 120,
      lockPerExtraPlayerMs: 1000 * 30,
      lockStepMs: 1000 * 45,
      lockMinTailMs: 1000 * 10,
      failPenalty: -3,
    };
  },

  createGame({ players, config, seed }) {
    const seated = [...players].sort((a, b) => a.seat - b.seat);
    const seatOrder = seated.map((p) => p.playerId);
    const playersMap: Record<string, WordRushPlayerState> = {};
    seated.forEach((p, i) => {
      playersMap[p.playerId] = {
        playerId: p.playerId,
        seat: i,
        totalScore: 0,
        guesses: [],
        status: "playing",
        finishedAt: null,
        solvedAt: null,
        roundScore: 0,
        placement: null,
      };
    });
    return {
      v: 1,
      game: "word-rush",
      seed: seed >>> 0,
      config,
      round: 0,
      phase: "racing",
      answer: "",
      seatOrder,
      players: playersMap,
      roundStartedAt: 0,
      lockDeadline: null,
      lockSeq: 0,
      finishOrder: [],
      usedWords: [],
      lastSummary: null,
    };
  },

  joinGame(state, player) {
    if (state.players[player.playerId] || state.round > 0) return state;
    const seat = state.seatOrder.length;
    return {
      ...state,
      seatOrder: [...state.seatOrder, player.playerId],
      players: {
        ...state.players,
        [player.playerId]: {
          playerId: player.playerId,
          seat,
          totalScore: 0,
          guesses: [],
          status: "playing",
          finishedAt: null,
          solvedAt: null,
          roundScore: 0,
          placement: null,
        },
      },
    };
  },

  startGame(state, ctx) {
    const dealt = dealRound(state, 1, ctx.now);
    return {
      ...dealt,
      events: [
        { type: "game_launch", audience: "tv", payload: { round: 1 } },
        ...dealt.events,
      ],
    };
  },

  validateMove(state, playerId, move) {
    return validate(state, playerId, move);
  },

  submitMove(state, playerId, move, ctx) {
    const check = validate(state, playerId, move);
    if (!check.ok) throw new Error(check.reason ?? "Illegal move");
    return applyGuess(state, playerId, move.word, ctx.now);
  },

  advanceTurn(state) {
    // Word Rush has no turn rotation — everyone plays at once.
    return state;
  },

  resume(state, ctx) {
    if (state.phase !== "round_over") {
      return { state, events: [], status: runtimeStatusOf(state.phase) };
    }
    return dealRound(state, state.round + 1, ctx.now);
  },

  /** The shared countdown expired — time out everyone still racing. */
  autoResolveTurn(state, _playerId, ctx) {
    if (state.phase !== "racing" || state.lockDeadline == null) {
      return { state, events: [], status: runtimeStatusOf(state.phase) };
    }
    return endRound(
      state,
      [{ type: "wr_time_up", audience: "all", payload: {} }],
      ctx.now,
    );
  },

  endGame(state) {
    const ordered = [...state.seatOrder].sort(
      (a, b) => getP(state, b).totalScore - getP(state, a).totalScore,
    );
    const top = ordered.length ? getP(state, ordered[0]!).totalScore : 0;
    const winners = ordered.filter((id) => getP(state, id).totalScore === top);

    const standings: GameStanding[] = [];
    let rank = 0;
    let prevScore: number | null = null;
    ordered.forEach((id, i) => {
      const score = getP(state, id).totalScore;
      if (prevScore === null || score < prevScore) {
        rank = i + 1;
        prevScore = score;
      }
      standings.push({
        playerId: id,
        rank,
        score,
        detail: `${score} pt${score === 1 ? "" : "s"}`,
      });
    });

    return { winners, standings } satisfies GameResult;
  },

  getPublicState(state, players): PublicWordRushView {
    return buildPublicView(state, players);
  },

  getPrivateState(state, playerId, players): PrivateWordRushView {
    const p = state.players[playerId];
    const active = countdownActive(state);
    let keyboard: Record<string, TileState> = {};
    if (p) for (const g of p.guesses) keyboard = mergeKeyboard(keyboard, g.word, g.pattern);

    return {
      game: "word-rush",
      status: runtimeStatusOf(state.phase),
      phase: state.phase,
      round: state.round,
      maxRounds: state.config.maxRounds,
      targetScore: state.config.targetScore,
      wordLength: state.config.wordLength,
      maxGuesses: state.config.maxGuesses,
      you: p
        ? {
            rows: p.guesses,
            guessesUsed: p.guesses.length,
            guessesLeft: state.config.maxGuesses - p.guesses.length,
            status: p.status,
            roundScore: p.roundScore,
            totalScore: p.totalScore,
            placement: p.placement,
            keyboard,
          }
        : {
            rows: [],
            guessesUsed: 0,
            guessesLeft: state.config.maxGuesses,
            status: "timed_out",
            roundScore: 0,
            totalScore: 0,
            placement: null,
            keyboard: {},
          },
      canGuess: !!p && state.phase === "racing" && p.status === "playing",
      countdownDeadline: active ? state.lockDeadline : null,
      reveal: state.phase === "racing" ? null : state.answer,
      // We render our own race clock in-view, so suppress the generic turn timer.
      isYourTurn: false,
      turnDeadline: active ? state.lockDeadline! : 0,
      scoreboard: scoreboard(state, players),
    };
  },

  serializeState(state) {
    return JSON.stringify(state);
  },

  deserializeState(raw) {
    return JSON.parse(raw) as WordRushState;
  },
};

export default WordRushEngine;

// Exported for unit tests.
export const _internal = {
  dealRound,
  endRound,
  applyGuess,
  validate,
  stillPlaying,
  countdownActive,
};
