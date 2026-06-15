import { type SeatedPlayer, TURN_BASE_MS } from "../../platform/types";
import { makeRng } from "../../platform/rng";
import {
  CHEAT_RANK_CYCLE,
  type Rank,
  type StandardCard,
  compareRank,
  compareSuit,
  createStandardDeck,
  dealAll,
  rankLabel,
  rankPlural,
  shuffleStandard,
} from "../../cards/standard";
import type {
  GameEngine,
  GameEventOut,
  GameMeta,
  GameResult,
  GameStepResult,
  MoveValidation,
} from "../types";
import type {
  ChallengeResult,
  CheatConfig,
  CheatMove,
  CheatPlayerState,
  CheatState,
  CheatTurn,
  LastPlay,
  PrivateCheatView,
  PublicCheatPlayer,
  PublicCheatView,
  PublicClaim,
} from "./types";

const META: GameMeta = {
  id: "cheat",
  name: "Cheat",
  tagline: "Lie with a straight face. (a.k.a. Bullshit)",
  description:
    "Dump your cards by claiming the rank of the turn — Aces, then 2s, then 3s… Tell the truth or bluff blind. Anyone can call “Cheat!”; guess wrong and you eat the whole pile. First to empty their hand wins.",
  minPlayers: 3,
  maxPlayers: 8,
  estimatedMinutes: 15,
  accent: "bubblegum",
  emoji: "🤥",
};

/* ------------------------------------------------------------------ utils */

function getP(state: CheatState, id: string): CheatPlayerState {
  const p = state.players[id];
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

function requiredRankAt(index: number): Rank {
  return CHEAT_RANK_CYCLE[index % CHEAT_RANK_CYCLE.length]!;
}

function nextSeatPlayer(state: CheatState, fromId: string): string {
  const idx = state.seatOrder.indexOf(fromId);
  return state.seatOrder[(idx + 1) % state.seatOrder.length]!;
}

function startTurn(prevSeq: number, now: number): CheatTurn {
  return { seq: prevSeq + 1, startedAt: now, deadline: now + TURN_BASE_MS };
}

function sortByRank(cards: readonly StandardCard[]): StandardCard[] {
  return cards.slice().sort((a, b) => compareRank(a, b) || compareSuit(a, b));
}

/**
 * A player wins the instant their last play is "locked in": they hold no cards
 * and there is no open claim of theirs left to challenge. Returns the id or null.
 */
function findWinner(state: CheatState): string | null {
  for (const pid of state.seatOrder) {
    const p = getP(state, pid);
    if (p.hand.length > 0) continue;
    if (state.lastPlay && state.lastPlay.playerId === pid) continue; // window open
    return pid;
  }
  return null;
}

/** Wrap a step, detecting a win that the transition may have locked in. */
function settle(
  state: CheatState,
  events: GameEventOut[],
): GameStepResult<CheatState> {
  const winnerId = findWinner(state);
  if (winnerId) {
    return {
      state: { ...state, winnerId, status: "game_over" },
      events: [...events, { type: "cheat_winner", audience: "all", payload: { winnerId } }],
      status: "game_over",
    };
  }
  return { state, events, status: "in_progress" };
}

/* --------------------------------------------------------- move handlers */

function applyPlay(
  state: CheatState,
  playerId: string,
  cardIds: string[],
  now: number,
): GameStepResult<CheatState> {
  const p = getP(state, playerId);
  const byId = new Map(p.hand.map((c) => [c.id, c]));
  const cards = cardIds.map((id) => {
    const c = byId.get(id);
    if (!c) throw new Error(`Card ${id} not in hand`);
    return c;
  });

  const claimedRank = requiredRankAt(state.requiredRankIndex);
  const usedIds = new Set(cardIds);
  const hand = p.hand.filter((c) => !usedIds.has(c.id));
  const lastPlay: LastPlay = { playerId, claimedRank, count: cards.length, cards };

  const next = nextSeatPlayer(state, playerId);
  const working: CheatState = {
    ...state,
    players: { ...state.players, [playerId]: { ...p, hand } },
    pile: [...state.pile, ...cards],
    lastPlay,
    lastChallenge: null,
    requiredRankIndex: (state.requiredRankIndex + 1) % CHEAT_RANK_CYCLE.length,
    currentPlayerId: next,
    turn: startTurn(state.turn.seq, now),
  };

  return settle(working, [
    {
      type: "cheat_play",
      audience: "all",
      payload: { playerId, claimedRank, count: cards.length },
    },
  ]);
}

function applyChallenge(
  state: CheatState,
  challengerId: string,
  now: number,
): GameStepResult<CheatState> {
  const last = state.lastPlay;
  if (!last) throw new Error("There is nothing to challenge");

  const wasBluff = last.cards.some((c) => c.rank !== last.claimedRank);
  const loserId = wasBluff ? last.playerId : challengerId;
  const pileSize = state.pile.length;

  const loser = getP(state, loserId);
  const players = {
    ...state.players,
    [loserId]: { ...loser, hand: sortByRank([...loser.hand, ...state.pile]) },
  };

  const challenge: ChallengeResult = {
    challengerId,
    accusedId: last.playerId,
    claimedRank: last.claimedRank,
    revealed: last.cards,
    wasBluff,
    loserId,
    pileSize,
  };

  const working: CheatState = {
    ...state,
    players,
    pile: [],
    lastPlay: null,
    lastChallenge: challenge,
    // The loser leads the next claim, at the (already advanced) required rank.
    currentPlayerId: loserId,
    turn: startTurn(state.turn.seq, now),
  };

  return settle(working, [
    { type: "cheat_challenge", audience: "all", payload: { challenge } },
  ]);
}

/* ----------------------------------------------------------- validation */

function validate(
  state: CheatState,
  playerId: string,
  move: CheatMove,
): MoveValidation {
  if (state.status !== "in_progress") {
    return { ok: false, reason: "The game is over" };
  }
  if (!state.players[playerId]) return { ok: false, reason: "You're not in this game" };

  if (move.type === "challenge") {
    if (!state.lastPlay) return { ok: false, reason: "There's no claim to challenge" };
    if (state.lastPlay.playerId === playerId) {
      return { ok: false, reason: "You can't challenge your own play" };
    }
    return { ok: true };
  }

  // play
  if (state.currentPlayerId !== playerId) return { ok: false, reason: "It's not your turn" };
  const p = getP(state, playerId);
  if (move.cardIds.length < 1) return { ok: false, reason: "Pick at least one card" };
  if (move.cardIds.length > state.config.maxClaim) {
    return { ok: false, reason: `You can play at most ${state.config.maxClaim} cards` };
  }
  if (new Set(move.cardIds).size !== move.cardIds.length) {
    return { ok: false, reason: "Duplicate card in your play" };
  }
  const held = new Set(p.hand.map((c) => c.id));
  for (const id of move.cardIds) {
    if (!held.has(id)) return { ok: false, reason: "You don't hold one of those cards" };
  }
  return { ok: true };
}

/* --------------------------------------------------------- projections */

function avatarOf(player: SeatedPlayer | undefined) {
  return player?.avatar ?? { color: "slate", emoji: "🙂" };
}

function publicPlayers(state: CheatState, players: SeatedPlayer[]): PublicCheatPlayer[] {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  return state.seatOrder.map((pid) => {
    const p = getP(state, pid);
    const sp = byId.get(pid);
    return {
      playerId: pid,
      displayName: sp?.displayName ?? "Player",
      avatar: avatarOf(sp),
      seat: p.seat,
      handCount: p.hand.length,
      isActive: sp?.isActive ?? false,
      isCurrent: pid === state.currentPlayerId,
    };
  });
}

function publicClaim(state: CheatState): PublicClaim | null {
  if (!state.lastPlay) return null;
  return {
    playerId: state.lastPlay.playerId,
    claimedRank: state.lastPlay.claimedRank,
    claimedRankLabel: rankPlural(state.lastPlay.claimedRank),
    count: state.lastPlay.count,
  };
}

function buildPublicView(state: CheatState, players: SeatedPlayer[]): PublicCheatView {
  const required = requiredRankAt(state.requiredRankIndex);
  return {
    game: "cheat",
    status: state.status,
    currentPlayerId: state.currentPlayerId,
    requiredRank: required,
    requiredRankLabel: rankPlural(required),
    players: publicPlayers(state, players),
    pileSize: state.pile.length,
    lastClaim: publicClaim(state),
    canBeChallenged: state.lastPlay !== null,
    lastChallenge: state.lastChallenge,
    winnerId: state.winnerId,
    round: 1,
    turnDeadline: state.turn.deadline,
    turnSeq: state.turn.seq,
  };
}

/* --------------------------------------------------------------- engine */

export const CheatEngine: GameEngine<CheatState, CheatMove, CheatConfig> = {
  meta: META,

  defaultConfig() {
    return { maxClaim: 4 };
  },

  createGame({ players, config, seed }) {
    const seated = [...players].sort((a, b) => a.seat - b.seat);
    const seatOrder = seated.map((p) => p.playerId);
    const playersMap: Record<string, CheatPlayerState> = {};
    seated.forEach((p, i) => {
      playersMap[p.playerId] = { playerId: p.playerId, seat: i, hand: [] };
    });
    return {
      v: 1,
      game: "cheat",
      seed: seed >>> 0,
      config,
      seatOrder,
      players: playersMap,
      currentPlayerId: seatOrder[0] ?? "",
      requiredRankIndex: 0,
      pile: [],
      lastPlay: null,
      lastChallenge: null,
      turn: { seq: 0, startedAt: 0, deadline: 0 },
      winnerId: null,
      status: "in_progress",
    };
  },

  joinGame(state, player) {
    if (state.players[player.playerId] || state.pile.length > 0) return state;
    const seat = state.seatOrder.length;
    return {
      ...state,
      seatOrder: [...state.seatOrder, player.playerId],
      players: {
        ...state.players,
        [player.playerId]: { playerId: player.playerId, seat, hand: [] },
      },
    };
  },

  startGame(state, ctx) {
    const rng = makeRng(ctx.seed >>> 0);
    const deck = shuffleStandard(createStandardDeck(), rng);
    const hands = dealAll(deck, state.seatOrder.length);
    const players: Record<string, CheatPlayerState> = {};
    state.seatOrder.forEach((pid, i) => {
      players[pid] = { ...getP(state, pid), hand: sortByRank(hands[i]!) };
    });
    return {
      state: {
        ...state,
        players,
        seed: ctx.seed >>> 0,
        currentPlayerId: state.seatOrder[0] ?? "",
        requiredRankIndex: 0, // first player starts with Aces
        turn: startTurn(state.turn.seq, ctx.now),
        status: "in_progress",
      },
      events: [
        { type: "game_launch", audience: "tv", payload: {} },
        { type: "cheat_deal", audience: "all", payload: {} },
      ],
      status: "in_progress",
    };
  },

  validateMove(state, playerId, move) {
    return validate(state, playerId, move);
  },

  submitMove(state, playerId, move, ctx) {
    const check = validate(state, playerId, move);
    if (!check.ok) throw new Error(check.reason ?? "Illegal move");
    if (move.type === "play") return applyPlay(state, playerId, move.cardIds, ctx.now);
    return applyChallenge(state, playerId, ctx.now);
  },

  advanceTurn(state, ctx) {
    const next = nextSeatPlayer(state, state.currentPlayerId);
    return { ...state, currentPlayerId: next, turn: startTurn(state.turn.seq, ctx.now) };
  },

  autoResolveTurn(state, playerId, ctx) {
    if (state.status !== "in_progress" || state.currentPlayerId !== playerId) {
      return { state, events: [], status: state.status };
    }
    const required = requiredRankAt(state.requiredRankIndex);
    const hand = getP(state, playerId).hand;
    // Prefer an honest single of the required rank; otherwise dump the lowest card.
    const honest = hand.find((c) => c.rank === required);
    const card = honest ?? sortByRank(hand)[0];
    if (!card) return { state, events: [], status: state.status };
    const step = applyPlay(state, playerId, [card.id], ctx.now);
    return {
      ...step,
      events: [{ type: "turn_timeout", audience: "all", payload: { playerId } }, ...step.events],
    };
  },

  endGame(state) {
    const entries = state.seatOrder.map((pid) => ({
      playerId: pid,
      cards: getP(state, pid).hand.length,
    }));
    entries.sort((a, b) => a.cards - b.cards);
    const standings = entries.map((e, i) => ({
      playerId: e.playerId,
      rank: i + 1,
      score: e.cards,
      detail: e.cards === 0 ? "Emptied their hand" : `${e.cards} cards left`,
    }));
    const winners = state.winnerId
      ? [state.winnerId]
      : standings[0]
        ? [standings[0].playerId]
        : [];
    return { winners, standings } satisfies GameResult;
  },

  getPublicState(state, players): PublicCheatView {
    return buildPublicView(state, players);
  },

  getPrivateState(state, playerId, players): PrivateCheatView {
    const p = getP(state, playerId);
    const required = requiredRankAt(state.requiredRankIndex);
    const isYourTurn = state.currentPlayerId === playerId && state.status === "in_progress";
    const canChallenge =
      state.status === "in_progress" &&
      state.lastPlay !== null &&
      state.lastPlay.playerId !== playerId;
    return {
      game: "cheat",
      status: state.status,
      you: { playerId, hand: sortByRank(p.hand) },
      isYourTurn,
      requiredRank: required,
      requiredRankLabel: rankPlural(required),
      turnDeadline: state.turn.deadline,
      actions: {
        canPlay: isYourTurn,
        minClaim: 1,
        maxClaim: state.config.maxClaim,
        canChallenge,
      },
      lastClaim: publicClaim(state),
      lastChallenge: state.lastChallenge,
      winnerId: state.winnerId,
      table: buildPublicView(state, players),
    };
  },

  serializeState(state) {
    return JSON.stringify(state);
  },

  deserializeState(raw) {
    return JSON.parse(raw) as CheatState;
  },
};

export default CheatEngine;

// Exported for unit tests.
export const _internal = { findWinner, requiredRankAt, rankLabel };
