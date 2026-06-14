import type { SeatedPlayer } from "../../platform/types";
import { makeRng } from "../../platform/rng";
import {
  advanceTurn as advanceTurnOrder,
  queueSkip,
  rotateStart,
} from "../../platform/turn";
import {
  type Card,
  DEBOX_DECK,
  isFreeze,
} from "../../cards/types";
import {
  createDeck,
  shuffleDeck,
  dealCards,
  drawCard,
  discardCard,
  topOf,
  recycleDiscard,
} from "../../cards/deck";
import { handPenalty, sortHand } from "../../cards/validate";
import { applyHitToGroup, buildLaidGroup, canHitLaidGroup } from "./melds";
import type {
  GameEngine,
  GameEventOut,
  GameMeta,
  GameResult,
  GameStepResult,
  MoveValidation,
} from "../types";
import {
  FIRST_PHASE,
  getPhase,
  HAND_SIZE,
  TOTAL_PHASES,
  validatePhase,
} from "./phases";
import type {
  LaidGroup,
  PhaseCardsConfig,
  PhaseCardsMove,
  PhaseCardsPlayer,
  PhaseCardsState,
  PublicGameView,
  PublicPlayerView,
  PrivateGameView,
  RoundPlayerSummary,
  RoundSummary,
} from "./types";

const META: GameMeta = {
  id: "phase-cards",
  name: "Phase Cards",
  tagline: "Race up the ten-phase ladder.",
  description:
    "A fast, friendly card climb. Complete ten escalating objectives — sets, runs and colors — before everyone else. Mind the Freeze.",
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: 30,
  accent: "grape",
  emoji: "🪜",
};

/* ------------------------------------------------------------------ utils */

function getP(state: PhaseCardsState, id: string): PhaseCardsPlayer {
  const p = state.players[id];
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

function freshPlayer(playerId: string): PhaseCardsPlayer {
  return {
    playerId,
    hand: [],
    phaseIndex: FIRST_PHASE,
    completedPhase: false,
    laidGroups: [],
    score: 0,
    finishedLadder: false,
  };
}

function eligibleForTurn(state: PhaseCardsState, id: string): boolean {
  const p = state.players[id];
  return !!p && !p.finishedLadder;
}

/** Deal a fresh round into `state` using `seed`. Pure. */
function dealRound(
  state: PhaseCardsState,
  round: number,
  seed: number,
): PhaseCardsState {
  const rng = makeRng(seed >>> 0);
  const deck = shuffleDeck(createDeck(DEBOX_DECK), rng);
  const { hands, drawPile } = dealCards(deck, state.seatOrder.length, HAND_SIZE);
  const { card: firstDiscard, pile: drawAfter } = drawCard(drawPile);

  const players: Record<string, PhaseCardsPlayer> = {};
  state.seatOrder.forEach((pid, i) => {
    const prev = getP(state, pid);
    players[pid] = {
      ...prev,
      hand: sortHand(hands[i]!),
      completedPhase: false,
      laidGroups: [],
    };
  });

  const firstPlayer = rotateStart(state.seatOrder, round - 1);

  // Rule: if the up-card that starts the discard pile is a Freeze (Skip), the
  // first player's turn is automatically skipped, and that counts as their one
  // skip for the round.
  let currentPlayerId = firstPlayer;
  const skippedThisRound: string[] = [];
  if (isFreeze(firstDiscard)) {
    const advanced = advanceTurnOrder(
      { order: state.seatOrder, currentId: firstPlayer, direction: 1, pendingSkips: {} },
      { isEligible: (id) => !players[id]!.finishedLadder },
    );
    currentPlayerId = advanced.currentId;
    skippedThisRound.push(firstPlayer);
  }

  return {
    ...state,
    seed,
    round,
    status: "in_progress",
    drawPile: drawAfter,
    discardPile: [firstDiscard],
    players,
    turn: {
      currentPlayerId,
      direction: 1,
      pendingSkips: {},
      hasDrawn: false,
      drewFrom: null,
    },
    skippedThisRound,
    lastRoundSummary: state.lastRoundSummary,
  };
}

function passTurn(
  state: PhaseCardsState,
  fromId: string,
  pendingSkips: Record<string, number>,
): { nextId: string; pendingSkips: Record<string, number>; skipped: string[] } {
  const advanced = advanceTurnOrder(
    {
      order: state.seatOrder,
      currentId: fromId,
      direction: state.turn.direction,
      pendingSkips,
    },
    { isEligible: (id) => eligibleForTurn(state, id) },
  );
  return {
    nextId: advanced.currentId,
    pendingSkips: advanced.pendingSkips,
    skipped: advanced.skipped,
  };
}

/* --------------------------------------------------------- round scoring */

function endRound(
  state: PhaseCardsState,
  wentOutId: string,
  priorEvents: GameEventOut[],
): GameStepResult<PhaseCardsState> {
  const players: Record<string, PhaseCardsPlayer> = { ...state.players };
  const summaries: RoundPlayerSummary[] = [];

  for (const pid of state.seatOrder) {
    const pl = getP(state, pid);
    const pointsAdded = handPenalty(pl.hand);
    const advanced = pl.completedPhase;
    const phaseBefore = pl.phaseIndex;
    const phaseAfter = advanced ? pl.phaseIndex + 1 : pl.phaseIndex;
    const finishedLadder = phaseAfter > TOTAL_PHASES;
    const totalScore = pl.score + pointsAdded;
    players[pid] = {
      ...pl,
      score: totalScore,
      phaseIndex: phaseAfter,
      finishedLadder,
    };
    summaries.push({
      playerId: pid,
      advanced,
      phaseBefore,
      phaseAfter,
      pointsAdded,
      totalScore,
      wentOut: pid === wentOutId,
    });
  }

  const summary: RoundSummary = {
    round: state.round,
    wentOutPlayerId: wentOutId,
    players: summaries,
  };

  const finishers = state.seatOrder.filter((pid) => players[pid]!.finishedLadder);
  if (finishers.length > 0) {
    const minScore = Math.min(...finishers.map((pid) => players[pid]!.score));
    const winnerIds = finishers.filter((pid) => players[pid]!.score === minScore);
    return {
      state: {
        ...state,
        players,
        status: "game_over",
        lastRoundSummary: summary,
        winnerIds,
      },
      events: [
        ...priorEvents,
        { type: "round_end", audience: "tv", payload: { summary } },
        { type: "game_over", audience: "all", payload: { winnerIds } },
      ],
      status: "game_over",
    };
  }

  return {
    state: { ...state, players, status: "round_over", lastRoundSummary: summary },
    events: [
      ...priorEvents,
      { type: "round_end", audience: "tv", payload: { summary } },
    ],
    status: "round_over",
  };
}

/* --------------------------------------------------------- move handlers */

function applyDraw(
  state: PhaseCardsState,
  playerId: string,
  source: "draw" | "discard",
): GameStepResult<PhaseCardsState> {
  let drawPile = state.drawPile;
  let discardPile = state.discardPile;
  let drawn: Card;

  if (source === "discard") {
    const r = drawCard(discardPile);
    drawn = r.card;
    discardPile = r.pile;
  } else {
    if (drawPile.length === 0) {
      const rec = recycleDiscard(
        discardPile,
        makeRng((state.seed ^ (state.round << 8) ^ discardPile.length) >>> 0),
      );
      drawPile = rec.drawPile;
      discardPile = rec.discardPile;
    }
    const r = drawCard(drawPile);
    drawn = r.card;
    drawPile = r.pile;
  }

  const p = getP(state, playerId);
  const players = {
    ...state.players,
    [playerId]: { ...p, hand: sortHand([...p.hand, drawn]) },
  };

  return {
    state: {
      ...state,
      drawPile,
      discardPile,
      players,
      turn: { ...state.turn, hasDrawn: true, drewFrom: source },
    },
    // Only a discard-pile draw is public knowledge (everyone saw the card).
    events: [
      {
        type: "card_draw",
        audience: "all",
        payload: { playerId, source, card: source === "discard" ? drawn : null },
      },
    ],
    status: "in_progress",
  };
}

function applyLayDown(
  state: PhaseCardsState,
  playerId: string,
  groupIds: string[][],
): GameStepResult<PhaseCardsState> {
  const p = getP(state, playerId);
  const phase = getPhase(p.phaseIndex);
  const byId = new Map(p.hand.map((c) => [c.id, c]));
  const groups: Card[][] = groupIds.map((ids) =>
    ids.map((id) => {
      const c = byId.get(id);
      if (!c) throw new Error(`Card ${id} not in hand`);
      return c;
    }),
  );

  const usedIds = new Set(groupIds.flat());
  const newHand = p.hand.filter((c) => !usedIds.has(c.id));
  const laidGroups: LaidGroup[] = phase.requirements.map((req, i) =>
    buildLaidGroup(req.type, req.label, groups[i]!),
  );

  const players = {
    ...state.players,
    [playerId]: { ...p, hand: newHand, completedPhase: true, laidGroups },
  };

  return {
    state: { ...state, players },
    events: [
      {
        type: "phase_complete",
        audience: "all",
        payload: { playerId, phaseIndex: p.phaseIndex, phaseName: phase.name },
      },
    ],
    status: "in_progress",
  };
}

function applyHit(
  state: PhaseCardsState,
  playerId: string,
  targetPlayerId: string,
  groupIndex: number,
  cardId: string,
): GameStepResult<PhaseCardsState> {
  const players: Record<string, PhaseCardsPlayer> = { ...state.players };
  const hitterBefore = getP(state, playerId);
  const card = hitterBefore.hand.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} not in hand`);

  const target = players[targetPlayerId];
  if (!target) throw new Error(`Unknown target ${targetPlayerId}`);
  const group = target.laidGroups[groupIndex];
  if (!group) throw new Error(`No group ${groupIndex} for ${targetPlayerId}`);

  const newGroup = applyHitToGroup(group, card);
  players[targetPlayerId] = {
    ...target,
    laidGroups: target.laidGroups.map((g, i) => (i === groupIndex ? newGroup : g)),
  };

  const hitter = players[playerId]!; // may reflect the target update if self-hit
  players[playerId] = {
    ...hitter,
    hand: hitter.hand.filter((c) => c.id !== cardId),
  };

  return {
    state: { ...state, players },
    events: [
      {
        type: "hit",
        audience: "all",
        payload: { playerId, targetPlayerId, groupIndex, card },
      },
    ],
    status: "in_progress",
  };
}

function applyDiscard(
  state: PhaseCardsState,
  playerId: string,
  cardId: string,
  skipTargetPlayerId: string | undefined,
): GameStepResult<PhaseCardsState> {
  const p = getP(state, playerId);
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} not in hand`);

  const newHand = p.hand.filter((c) => c.id !== cardId);
  const discardPile = discardCard(state.discardPile, card);
  let pendingSkips = state.turn.pendingSkips;
  let skippedThisRound = state.skippedThisRound ?? [];
  const events: GameEventOut[] = [
    { type: "card_discard", audience: "all", payload: { playerId, card } },
  ];

  if (isFreeze(card) && skipTargetPlayerId) {
    pendingSkips = queueSkip(pendingSkips, skipTargetPlayerId, 1);
    skippedThisRound = [...skippedThisRound, skipTargetPlayerId];
    events.push({
      type: "freeze",
      audience: "all",
      payload: { byPlayerId: playerId, targetPlayerId: skipTargetPlayerId },
    });
  }

  const players = { ...state.players, [playerId]: { ...p, hand: newHand } };
  const baseState: PhaseCardsState = {
    ...state,
    players,
    discardPile,
    skippedThisRound,
  };

  if (newHand.length === 0) {
    events.push({ type: "player_out", audience: "all", payload: { playerId } });
    return endRound(
      { ...baseState, turn: { ...baseState.turn, pendingSkips } },
      playerId,
      events,
    );
  }

  const { nextId, pendingSkips: nextSkips, skipped } = passTurn(
    baseState,
    playerId,
    pendingSkips,
  );
  if (skipped.length > 0) {
    events.push({ type: "turn_skipped", audience: "all", payload: { skipped } });
  }
  events.push({ type: "turn_start", audience: "all", payload: { playerId: nextId } });

  return {
    state: {
      ...baseState,
      turn: {
        currentPlayerId: nextId,
        direction: state.turn.direction,
        pendingSkips: nextSkips,
        hasDrawn: false,
        drewFrom: null,
      },
    },
    events,
    status: "in_progress",
  };
}

/* ----------------------------------------------------------- validation */

function validate(
  state: PhaseCardsState,
  playerId: string,
  move: PhaseCardsMove,
): MoveValidation {
  if (state.status !== "in_progress") {
    return { ok: false, reason: "The game isn't accepting moves right now" };
  }
  if (!state.players[playerId]) {
    return { ok: false, reason: "You're not in this game" };
  }
  if (state.turn.currentPlayerId !== playerId) {
    return { ok: false, reason: "It's not your turn" };
  }
  const p = getP(state, playerId);
  const { hasDrawn } = state.turn;

  switch (move.type) {
    case "draw": {
      if (hasDrawn) return { ok: false, reason: "You've already drawn this turn" };
      if (move.source === "discard") {
        const top = topOf(state.discardPile);
        if (!top) return { ok: false, reason: "The discard pile is empty" };
        if (isFreeze(top)) {
          return { ok: false, reason: "You can't take a Freeze from the discard" };
        }
      } else if (state.drawPile.length === 0 && state.discardPile.length <= 1) {
        return { ok: false, reason: "There are no cards left to draw" };
      }
      return { ok: true };
    }
    case "layDown": {
      if (!hasDrawn) return { ok: false, reason: "Draw a card first" };
      if (p.completedPhase) {
        return { ok: false, reason: "You've already laid down your phase this round" };
      }
      const byId = new Map(p.hand.map((c) => [c.id, c]));
      const groups: Card[][] = [];
      for (const ids of move.groups) {
        const g: Card[] = [];
        for (const id of ids) {
          const c = byId.get(id);
          if (!c) return { ok: false, reason: "You don't hold one of those cards" };
          g.push(c);
        }
        groups.push(g);
      }
      const phase = getPhase(p.phaseIndex);
      const res = validatePhase(phase, groups);
      if (!res.ok) return { ok: false, reason: res.reason };
      return { ok: true };
    }
    case "hit": {
      if (!hasDrawn) return { ok: false, reason: "Draw a card first" };
      if (!p.completedPhase) {
        return { ok: false, reason: "Lay down your own phase before adding to melds" };
      }
      const card = p.hand.find((c) => c.id === move.cardId);
      if (!card) return { ok: false, reason: "You don't hold that card" };
      const target = state.players[move.targetPlayerId];
      if (!target) return { ok: false, reason: "Unknown target player" };
      const group = target.laidGroups[move.groupIndex];
      if (!group) return { ok: false, reason: "That meld doesn't exist" };
      const res = canHitLaidGroup(group, card);
      if (!res.ok) return { ok: false, reason: res.reason };
      return { ok: true };
    }
    case "discard": {
      if (!hasDrawn) return { ok: false, reason: "Draw before discarding" };
      const card = p.hand.find((c) => c.id === move.cardId);
      if (!card) return { ok: false, reason: "You don't hold that card" };
      if (isFreeze(card)) {
        // One Skip per player per round: a player already frozen this round
        // can't be targeted again.
        const alreadySkipped = state.skippedThisRound ?? [];
        const eligibleTargets = state.seatOrder.filter(
          (id) =>
            id !== playerId &&
            eligibleForTurn(state, id) &&
            !alreadySkipped.includes(id),
        );
        if (eligibleTargets.length > 0) {
          if (!move.skipTargetPlayerId) {
            return { ok: false, reason: "Choose a player to freeze" };
          }
          if (!eligibleTargets.includes(move.skipTargetPlayerId)) {
            return { ok: false, reason: "You can't freeze that player again this round" };
          }
        }
      }
      return { ok: true };
    }
  }
}

/* --------------------------------------------------------- projections */

function avatarOf(player: SeatedPlayer | undefined) {
  return player?.avatar ?? { color: "slate", emoji: "🙂" };
}

function publicPlayers(
  state: PhaseCardsState,
  players: SeatedPlayer[],
): PublicPlayerView[] {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  return state.seatOrder.map((pid) => {
    const p = getP(state, pid);
    const sp = byId.get(pid);
    const phaseName = p.finishedLadder
      ? "Champion"
      : getPhase(p.phaseIndex).name;
    return {
      playerId: pid,
      displayName: sp?.displayName ?? "Player",
      avatar: avatarOf(sp),
      seat: sp?.seat ?? 0,
      phaseIndex: p.phaseIndex,
      phaseName,
      handCount: p.hand.length,
      completedPhase: p.completedPhase,
      laidGroups: p.laidGroups,
      score: p.score,
      finishedLadder: p.finishedLadder,
      isActive: sp?.isActive ?? false,
    };
  });
}

/* --------------------------------------------------------------- engine */

export const PhaseCardsEngine: GameEngine<
  PhaseCardsState,
  PhaseCardsMove,
  PhaseCardsConfig
> = {
  meta: META,

  defaultConfig() {
    return { recycleDiscard: true };
  },

  createGame({ players, seed }) {
    const seated = [...players].sort((a, b) => a.seat - b.seat);
    const seatOrder = seated.map((p) => p.playerId);
    const playersMap: Record<string, PhaseCardsPlayer> = {};
    for (const p of seated) playersMap[p.playerId] = freshPlayer(p.playerId);
    return {
      v: 1,
      game: "phase-cards",
      seed: seed >>> 0,
      round: 0,
      status: "in_progress",
      turn: {
        currentPlayerId: seatOrder[0] ?? "",
        direction: 1,
        pendingSkips: {},
        hasDrawn: false,
        drewFrom: null,
      },
      drawPile: [],
      discardPile: [],
      seatOrder,
      players: playersMap,
      lastRoundSummary: null,
      winnerIds: [],
      startedAt: null,
      skippedThisRound: [],
    };
  },

  joinGame(state, player) {
    if (state.players[player.playerId]) return state;
    if (state.round > 0) return state; // can't join a game in progress
    return {
      ...state,
      seatOrder: [...state.seatOrder, player.playerId],
      players: {
        ...state.players,
        [player.playerId]: freshPlayer(player.playerId),
      },
    };
  },

  startGame(state, ctx) {
    const dealt = dealRound({ ...state, startedAt: ctx.now }, 1, ctx.seed);
    return {
      state: dealt,
      events: [
        { type: "game_launch", audience: "tv", payload: { round: 1 } },
        {
          type: "turn_start",
          audience: "all",
          payload: { playerId: dealt.turn.currentPlayerId },
        },
      ],
      status: "in_progress",
    };
  },

  validateMove(state, playerId, move) {
    return validate(state, playerId, move);
  },

  submitMove(state, playerId, move, _ctx) {
    const check = validate(state, playerId, move);
    if (!check.ok) throw new Error(check.reason ?? "Illegal move");
    switch (move.type) {
      case "draw":
        return applyDraw(state, playerId, move.source);
      case "layDown":
        return applyLayDown(state, playerId, move.groups);
      case "hit":
        return applyHit(
          state,
          playerId,
          move.targetPlayerId,
          move.groupIndex,
          move.cardId,
        );
      case "discard":
        return applyDiscard(state, playerId, move.cardId, move.skipTargetPlayerId);
    }
  },

  advanceTurn(state) {
    const { nextId, pendingSkips } = passTurn(
      state,
      state.turn.currentPlayerId,
      state.turn.pendingSkips,
    );
    return {
      ...state,
      turn: {
        currentPlayerId: nextId,
        direction: state.turn.direction,
        pendingSkips,
        hasDrawn: false,
        drewFrom: null,
      },
    };
  },

  resume(state, ctx) {
    if (state.status !== "round_over") {
      return { state, events: [], status: state.status };
    }
    const nextRound = state.round + 1;
    const dealt = dealRound(state, nextRound, ctx.seed);
    return {
      state: dealt,
      events: [
        { type: "round_start", audience: "all", payload: { round: nextRound } },
        {
          type: "turn_start",
          audience: "all",
          payload: { playerId: dealt.turn.currentPlayerId },
        },
      ],
      status: "in_progress",
    };
  },

  endGame(state) {
    const entries = state.seatOrder.map((pid) => {
      const p = getP(state, pid);
      return {
        playerId: pid,
        score: p.score,
        progress: p.phaseIndex,
        finished: p.finishedLadder,
      };
    });
    entries.sort(
      (a, b) =>
        Number(b.finished) - Number(a.finished) ||
        b.progress - a.progress ||
        a.score - b.score,
    );
    const standings = entries.map((e, i) => ({
      playerId: e.playerId,
      rank: i + 1,
      score: e.score,
      progress: e.progress,
      detail: e.finished
        ? "Reached the summit"
        : `Phase ${Math.min(e.progress, TOTAL_PHASES)}`,
    }));
    const winners =
      state.winnerIds.length > 0
        ? state.winnerIds
        : standings[0]
          ? [standings[0].playerId]
          : [];
    return { winners, standings } satisfies GameResult;
  },

  getPublicState(state, players): PublicGameView {
    return {
      game: "phase-cards",
      round: state.round,
      status: state.status,
      currentPlayerId: state.turn.currentPlayerId,
      direction: state.turn.direction,
      discardTop: topOf(state.discardPile),
      drawCount: state.drawPile.length,
      discardCount: state.discardPile.length,
      players: publicPlayers(state, players),
      lastRoundSummary: state.lastRoundSummary,
      winnerIds: state.winnerIds,
    };
  },

  getPrivateState(state, playerId, players): PrivateGameView {
    const p = getP(state, playerId);
    const phase = getPhase(Math.min(p.phaseIndex, TOTAL_PHASES));
    const isYourTurn =
      state.turn.currentPlayerId === playerId && state.status === "in_progress";
    const { hasDrawn } = state.turn;
    const discardTop = topOf(state.discardPile);
    const table = publicPlayers(state, players);
    const anyMelds = table.some((t) => t.laidGroups.length > 0);

    return {
      game: "phase-cards",
      you: {
        playerId,
        hand: p.hand,
        phaseIndex: p.phaseIndex,
        phaseName: p.finishedLadder ? "Champion" : phase.name,
        phaseBlurb: phase.blurb,
        requirements: phase.requirements.map((r) => ({
          type: r.type,
          count: r.count,
          label: r.label,
        })),
        completedPhase: p.completedPhase,
        laidGroups: p.laidGroups,
        score: p.score,
        finishedLadder: p.finishedLadder,
      },
      isYourTurn,
      currentPlayerId: state.turn.currentPlayerId,
      hasDrawn,
      actions: {
        canDraw:
          isYourTurn &&
          !hasDrawn &&
          (state.drawPile.length > 0 || state.discardPile.length > 1),
        canDrawFromDiscard:
          isYourTurn && !hasDrawn && !!discardTop && !isFreeze(discardTop),
        canLayDown: isYourTurn && hasDrawn && !p.completedPhase,
        canHit: isYourTurn && hasDrawn && p.completedPhase && anyMelds,
        mustDiscard: isYourTurn && hasDrawn,
      },
      discardTop,
      drawCount: state.drawPile.length,
      round: state.round,
      status: state.status,
      table,
      frozenThisRound: state.skippedThisRound ?? [],
    };
  },

  serializeState(state) {
    return JSON.stringify(state);
  },

  deserializeState(raw) {
    return JSON.parse(raw) as PhaseCardsState;
  },
};

export default PhaseCardsEngine;
