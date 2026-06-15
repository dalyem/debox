import {
  type SeatedPlayer,
  TURN_BASE_MS,
} from "../../platform/types";
import { makeRng } from "../../platform/rng";
import {
  type StandardCard,
  type Suit,
  cardsOfSuit,
  compareRank,
  createStandardDeck,
  dealHands,
  shuffleStandard,
  sortStandardHand,
} from "../../cards/standard";
import { decideWinner, scoreTeamRound, type PlayerRoundInput } from "./scoring";
import type {
  GameEngine,
  GameEventOut,
  GameMeta,
  GameResult,
  GameRuntimeStatus,
  GameStepResult,
  MoveValidation,
} from "../types";
import type {
  PrivateSpadesView,
  PublicSpadesPlayer,
  PublicSpadesView,
  PublicTeam,
  SpadesConfig,
  SpadesMove,
  SpadesPhase,
  SpadesPlayerState,
  SpadesRoundSummary,
  SpadesState,
  SpadesTeamState,
  SpadesTrick,
  SpadesTurn,
  TeamId,
  TeamRoundSummary,
} from "./types";

const META: GameMeta = {
  id: "spades",
  name: "Spades",
  tagline: "Call your tricks. Trust your partner.",
  description:
    "The classic partnership trick-taking game for four. Bid how many tricks your team will win, then deliver — spades are always trump. First team to 500 takes it.",
  minPlayers: 4,
  maxPlayers: 4,
  estimatedMinutes: 25,
  accent: "lagoon",
  emoji: "♠️",
};

const HAND_SIZE = 13;
const TRICKS_PER_ROUND = 13;

/* ------------------------------------------------------------------ utils */

function getP(state: SpadesState, id: string): SpadesPlayerState {
  const p = state.players[id];
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

function teamOfSeat(seat: number): TeamId {
  return (seat % 2) as TeamId;
}

function runtimeStatusOf(phase: SpadesPhase): GameRuntimeStatus {
  if (phase === "game_over") return "game_over";
  if (phase === "round_over") return "round_over";
  return "in_progress";
}

function seatIndexOf(state: SpadesState, playerId: string): number {
  return state.seatOrder.indexOf(playerId);
}

function nextSeatPlayer(state: SpadesState, fromId: string): string {
  const idx = seatIndexOf(state, fromId);
  return state.seatOrder[(idx + 1) % state.seatOrder.length]!;
}

function startTurn(currentPlayerId: string, prevSeq: number, now: number): SpadesTurn {
  return {
    currentPlayerId,
    seq: prevSeq + 1,
    startedAt: now,
    deadline: now + TURN_BASE_MS,
  };
}

function emptyTrick(leaderId: string): SpadesTrick {
  return { leaderId, ledSuit: null, plays: [] };
}

function isNilBid(bid: number | null, config: SpadesConfig): boolean {
  return config.allowNil && bid === 0;
}

/** The cards a player may legally play right now (leader vs follower rules). */
function legalPlays(state: SpadesState, player: SpadesPlayerState): StandardCard[] {
  const { hand } = player;
  const leading = state.trick.plays.length === 0;

  if (leading) {
    if (state.spadesBroken) return hand.slice();
    const nonSpades = hand.filter((c) => c.suit !== "spades");
    // Spades can't be led until broken — unless that's all you hold.
    return nonSpades.length > 0 ? nonSpades : hand.slice();
  }

  const led = state.trick.ledSuit;
  if (led) {
    const followers = hand.filter((c) => c.suit === led);
    if (followers.length > 0) return followers;
  }
  return hand.slice(); // void in the led suit → anything goes
}

/** Winner of a completed 4-card trick: highest spade, else highest of led suit. */
function trickWinner(trick: SpadesTrick): string {
  const spades = trick.plays.filter((p) => p.card.suit === "spades");
  const contenders =
    spades.length > 0
      ? spades
      : trick.plays.filter((p) => p.card.suit === trick.ledSuit);
  let best = contenders[0]!;
  for (const p of contenders) {
    if (compareRank(p.card, best.card) > 0) best = p;
  }
  return best.playerId;
}

/* --------------------------------------------------------------- dealing */

function freshTeams(prev?: [SpadesTeamState, SpadesTeamState]): [SpadesTeamState, SpadesTeamState] {
  return [
    { team: 0, score: prev?.[0].score ?? 0, bags: prev?.[0].bags ?? 0 },
    { team: 1, score: prev?.[1].score ?? 0, bags: prev?.[1].bags ?? 0 },
  ];
}

/** Deal a fresh round into `state`, opening the bidding phase. Pure. */
function dealRound(
  state: SpadesState,
  round: number,
  seed: number,
  now: number,
): SpadesState {
  const rng = makeRng(seed >>> 0);
  const deck = shuffleStandard(createStandardDeck(), rng);
  const { hands } = dealHands(deck, state.seatOrder.length, HAND_SIZE);

  const players: Record<string, SpadesPlayerState> = {};
  state.seatOrder.forEach((pid, i) => {
    const prev = getP(state, pid);
    players[pid] = {
      ...prev,
      hand: sortStandardHand(hands[i]!),
      bid: null,
      tricksWon: 0,
    };
  });

  const firstSeat = (round - 1) % state.seatOrder.length;
  const firstBidder = state.seatOrder[firstSeat]!;

  return {
    ...state,
    seed,
    round,
    phase: "bidding",
    firstSeat,
    players,
    teams: freshTeams(state.teams),
    trick: emptyTrick(firstBidder),
    completedTricks: 0,
    spadesBroken: false,
    turn: startTurn(firstBidder, state.turn.seq, now),
    lastTrickWinnerId: null,
  };
}

/* --------------------------------------------------------- round scoring */

function endRound(
  state: SpadesState,
  priorEvents: GameEventOut[],
): GameStepResult<SpadesState> {
  const summaries: TeamRoundSummary[] = [];
  const teams = freshTeams(state.teams);

  ([0, 1] as TeamId[]).forEach((teamId) => {
    const members = state.seatOrder
      .map((pid) => getP(state, pid))
      .filter((p) => p.team === teamId);
    const inputs: PlayerRoundInput[] = members.map((p) => ({
      playerId: p.playerId,
      team: teamId,
      bid: p.bid ?? 0,
      isNil: isNilBid(p.bid, state.config),
      tricks: p.tricksWon,
    }));
    const before = state.teams[teamId].score;
    const res = scoreTeamRound(inputs, state.teams[teamId].bags, state.config);
    teams[teamId] = {
      team: teamId,
      score: before + res.roundDelta,
      bags: res.newBags,
    };
    summaries.push({
      team: teamId,
      bid: res.combinedBid,
      tricks: res.combinedTricks,
      madeContract: res.madeContract,
      contractDelta: res.contractDelta,
      bagsThisRound: res.bagsThisRound,
      bagPenalty: res.bagPenalty,
      nilDelta: res.nilDelta,
      roundDelta: res.roundDelta,
      scoreBefore: before,
      scoreAfter: before + res.roundDelta,
      nil: res.nil,
    });
  });

  const summary: SpadesRoundSummary = { round: state.round, teams: summaries };
  const winnerTeam = decideWinner(
    [teams[0].score, teams[1].score],
    state.config.targetScore,
  );

  if (winnerTeam !== null) {
    const winners = state.seatOrder.filter((pid) => getP(state, pid).team === winnerTeam);
    return {
      state: {
        ...state,
        teams,
        phase: "game_over",
        winnerTeam,
        lastRoundSummary: summary,
      },
      events: [
        ...priorEvents,
        { type: "round_end", audience: "tv", payload: { summary } },
        { type: "game_over", audience: "all", payload: { winnerTeam, winners } },
      ],
      status: "game_over",
    };
  }

  return {
    state: { ...state, teams, phase: "round_over", lastRoundSummary: summary },
    events: [
      ...priorEvents,
      { type: "round_end", audience: "tv", payload: { summary } },
    ],
    status: "round_over",
  };
}

/* --------------------------------------------------------- move handlers */

function applyBid(
  state: SpadesState,
  playerId: string,
  bid: number,
  now: number,
): GameStepResult<SpadesState> {
  const p = getP(state, playerId);
  const players = { ...state.players, [playerId]: { ...p, bid } };
  const nil = isNilBid(bid, state.config);
  const events: GameEventOut[] = [
    { type: "spades_bid", audience: "all", payload: { playerId, bid, nil } },
  ];

  const allBid = state.seatOrder.every((pid) => players[pid]!.bid !== null);
  if (allBid) {
    const leader = state.seatOrder[state.firstSeat]!;
    events.push({ type: "spades_bids_complete", audience: "all", payload: {} });
    return {
      state: {
        ...state,
        players,
        phase: "playing",
        trick: emptyTrick(leader),
        turn: startTurn(leader, state.turn.seq, now),
      },
      events,
      status: "in_progress",
    };
  }

  const next = nextSeatPlayer(state, playerId);
  return {
    state: { ...state, players, turn: startTurn(next, state.turn.seq, now) },
    events,
    status: "in_progress",
  };
}

function applyPlay(
  state: SpadesState,
  playerId: string,
  cardId: string,
  now: number,
): GameStepResult<SpadesState> {
  const p = getP(state, playerId);
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} not in hand`);

  const hand = p.hand.filter((c) => c.id !== cardId);
  const leading = state.trick.plays.length === 0;
  const ledSuit: Suit | null = leading ? card.suit : state.trick.ledSuit;
  const breaks = card.suit === "spades" && !state.spadesBroken;

  const trick: SpadesTrick = {
    leaderId: leading ? playerId : state.trick.leaderId,
    ledSuit,
    plays: [...state.trick.plays, { playerId, card }],
  };
  const players = { ...state.players, [playerId]: { ...p, hand } };
  const events: GameEventOut[] = [
    { type: "spades_play", audience: "all", payload: { playerId, card, leading } },
  ];
  if (breaks) {
    events.push({ type: "spades_broken", audience: "all", payload: { playerId } });
  }

  const working: SpadesState = {
    ...state,
    players,
    trick,
    spadesBroken: state.spadesBroken || card.suit === "spades",
  };

  // Trick still in progress — pass to the next seat.
  if (trick.plays.length < state.seatOrder.length) {
    const next = nextSeatPlayer(state, playerId);
    return {
      state: { ...working, turn: startTurn(next, state.turn.seq, now) },
      events,
      status: "in_progress",
    };
  }

  // Trick complete — award it.
  const winnerId = trickWinner(trick);
  const winner = getP(working, winnerId);
  const afterWin: SpadesState = {
    ...working,
    players: {
      ...working.players,
      [winnerId]: { ...winner, tricksWon: winner.tricksWon + 1 },
    },
    completedTricks: working.completedTricks + 1,
    lastTrickWinnerId: winnerId,
    trick: emptyTrick(winnerId),
  };
  events.push({
    type: "spades_trick_won",
    audience: "all",
    payload: { playerId: winnerId, team: winner.team },
  });

  if (afterWin.completedTricks >= TRICKS_PER_ROUND) {
    return endRound(afterWin, events);
  }

  return {
    state: { ...afterWin, turn: startTurn(winnerId, state.turn.seq, now) },
    events,
    status: "in_progress",
  };
}

/* ----------------------------------------------------------- validation */

function validate(
  state: SpadesState,
  playerId: string,
  move: SpadesMove,
): MoveValidation {
  if (state.phase !== "bidding" && state.phase !== "playing") {
    return { ok: false, reason: "The game isn't accepting moves right now" };
  }
  if (!state.players[playerId]) return { ok: false, reason: "You're not in this game" };
  if (state.turn.currentPlayerId !== playerId) {
    return { ok: false, reason: "It's not your turn" };
  }
  const p = getP(state, playerId);

  if (move.type === "bid") {
    if (state.phase !== "bidding") return { ok: false, reason: "Bidding is closed" };
    if (p.bid !== null) return { ok: false, reason: "You've already bid" };
    if (!Number.isInteger(move.bid)) return { ok: false, reason: "Bid must be a whole number" };
    const min = state.config.allowNil ? 0 : 1;
    if (move.bid < min || move.bid > HAND_SIZE) {
      return { ok: false, reason: `Bid must be between ${min} and ${HAND_SIZE}` };
    }
    return { ok: true };
  }

  // play
  if (state.phase !== "playing") return { ok: false, reason: "You can't play a card yet" };
  const card = p.hand.find((c) => c.id === move.cardId);
  if (!card) return { ok: false, reason: "You don't hold that card" };
  const legal = legalPlays(state, p);
  if (!legal.some((c) => c.id === card.id)) {
    if (state.trick.plays.length === 0 && card.suit === "spades") {
      return { ok: false, reason: "Spades haven't been broken yet" };
    }
    return { ok: false, reason: `You must follow ${state.trick.ledSuit}` };
  }
  return { ok: true };
}

/* --------------------------------------------------------- projections */

function avatarOf(player: SeatedPlayer | undefined) {
  return player?.avatar ?? { color: "slate", emoji: "🙂" };
}

function publicPlayers(
  state: SpadesState,
  players: SeatedPlayer[],
): PublicSpadesPlayer[] {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  return state.seatOrder.map((pid) => {
    const p = getP(state, pid);
    const sp = byId.get(pid);
    return {
      playerId: pid,
      displayName: sp?.displayName ?? "Player",
      avatar: avatarOf(sp),
      seat: p.seat,
      team: p.team,
      bid: p.bid,
      tricksWon: p.tricksWon,
      handCount: p.hand.length,
      isActive: sp?.isActive ?? false,
    };
  });
}

function publicTeam(state: SpadesState, teamId: TeamId): PublicTeam {
  const members = state.seatOrder
    .map((pid) => getP(state, pid))
    .filter((p) => p.team === teamId);
  const bothBid = members.every((m) => m.bid !== null);
  const bid = bothBid ? members.reduce((s, m) => s + (m.bid ?? 0), 0) : null;
  const tricks = members.reduce((s, m) => s + m.tricksWon, 0);
  return {
    team: teamId,
    score: state.teams[teamId].score,
    bags: state.teams[teamId].bags,
    bid,
    tricks,
  };
}

function buildPublicView(state: SpadesState, players: SeatedPlayer[]): PublicSpadesView {
  return {
    game: "spades",
    status: runtimeStatusOf(state.phase),
    phase: state.phase,
    round: state.round,
    currentPlayerId: state.turn.currentPlayerId,
    players: publicPlayers(state, players),
    teams: [publicTeam(state, 0), publicTeam(state, 1)],
    trick: state.trick,
    spadesBroken: state.spadesBroken,
    completedTricks: state.completedTricks,
    lastTrickWinnerId: state.lastTrickWinnerId,
    lastRoundSummary: state.lastRoundSummary,
    winnerTeam: state.winnerTeam,
    targetScore: state.config.targetScore,
    turnDeadline: state.turn.deadline,
    turnSeq: state.turn.seq,
  };
}

/* --------------------------------------------------------------- engine */

export const SpadesEngine: GameEngine<SpadesState, SpadesMove, SpadesConfig> = {
  meta: META,

  defaultConfig() {
    return { targetScore: 500, allowNil: true, nilValue: 100, bagPenalty: 100 };
  },

  createGame({ players, config, seed }) {
    const seated = [...players].sort((a, b) => a.seat - b.seat);
    const seatOrder = seated.map((p) => p.playerId);
    const playersMap: Record<string, SpadesPlayerState> = {};
    seated.forEach((p, i) => {
      playersMap[p.playerId] = {
        playerId: p.playerId,
        seat: i,
        team: teamOfSeat(i),
        hand: [],
        bid: null,
        tricksWon: 0,
      };
    });
    return {
      v: 1,
      game: "spades",
      seed: seed >>> 0,
      round: 0,
      phase: "bidding",
      config,
      firstSeat: 0,
      seatOrder,
      players: playersMap,
      teams: freshTeams(),
      trick: emptyTrick(seatOrder[0] ?? ""),
      completedTricks: 0,
      spadesBroken: false,
      turn: { currentPlayerId: seatOrder[0] ?? "", seq: 0, startedAt: 0, deadline: 0 },
      lastTrickWinnerId: null,
      lastRoundSummary: null,
      winnerTeam: null,
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
          team: teamOfSeat(seat),
          hand: [],
          bid: null,
          tricksWon: 0,
        },
      },
    };
  },

  startGame(state, ctx) {
    const dealt = dealRound(state, 1, ctx.seed, ctx.now);
    return {
      state: dealt,
      events: [
        { type: "game_launch", audience: "tv", payload: { round: 1 } },
        { type: "spades_deal", audience: "all", payload: { round: 1 } },
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
    if (move.type === "bid") return applyBid(state, playerId, move.bid, ctx.now);
    return applyPlay(state, playerId, move.cardId, ctx.now);
  },

  advanceTurn(state, ctx) {
    const next = nextSeatPlayer(state, state.turn.currentPlayerId);
    return { ...state, turn: startTurn(next, state.turn.seq, ctx.now) };
  },

  resume(state, ctx) {
    if (state.phase !== "round_over") {
      return { state, events: [], status: runtimeStatusOf(state.phase) };
    }
    const nextRound = state.round + 1;
    const dealt = dealRound(state, nextRound, ctx.seed, ctx.now);
    return {
      state: dealt,
      events: [{ type: "spades_deal", audience: "all", payload: { round: nextRound } }],
      status: "in_progress",
    };
  },

  autoResolveTurn(state, playerId, ctx) {
    if (
      (state.phase !== "bidding" && state.phase !== "playing") ||
      state.turn.currentPlayerId !== playerId
    ) {
      return { state, events: [], status: runtimeStatusOf(state.phase) };
    }
    const timeout: GameEventOut = {
      type: "turn_timeout",
      audience: "all",
      payload: { playerId },
    };

    if (state.phase === "bidding") {
      // Conservative auto-bid: roughly your spade count, never an accidental nil.
      const spades = getP(state, playerId).hand.filter((c) => c.suit === "spades").length;
      const bid = Math.max(1, spades);
      const step = applyBid(state, playerId, bid, ctx.now);
      return { ...step, events: [timeout, ...step.events] };
    }

    // Auto-play the lowest legal card.
    const legal = legalPlays(state, getP(state, playerId));
    const card = legal.slice().sort(compareRank)[0]!;
    const step = applyPlay(state, playerId, card.id, ctx.now);
    return { ...step, events: [timeout, ...step.events] };
  },

  endGame(state) {
    const t0 = state.teams[0].score;
    const t1 = state.teams[1].score;
    const winTeam: TeamId = state.winnerTeam ?? (t1 > t0 ? 1 : 0);
    const standings = state.seatOrder
      .map((pid) => {
        const p = getP(state, pid);
        return {
          playerId: pid,
          team: p.team,
          score: state.teams[p.team].score,
          rank: p.team === winTeam ? 1 : 3,
          detail: `Team ${p.team === 0 ? "A" : "B"}${p.team === winTeam ? " · won" : ""}`,
        };
      })
      .sort((a, b) => a.rank - b.rank || b.score - a.score);
    const winners = state.seatOrder.filter((pid) => getP(state, pid).team === winTeam);
    return { winners, standings } satisfies GameResult;
  },

  getPublicState(state, players): PublicSpadesView {
    return buildPublicView(state, players);
  },

  getPrivateState(state, playerId, players): PrivateSpadesView {
    const p = getP(state, playerId);
    const isYourTurn =
      state.turn.currentPlayerId === playerId &&
      (state.phase === "bidding" || state.phase === "playing");
    const canBid = isYourTurn && state.phase === "bidding" && p.bid === null;
    const canPlay = isYourTurn && state.phase === "playing";
    return {
      game: "spades",
      status: runtimeStatusOf(state.phase),
      phase: state.phase,
      you: {
        playerId,
        seat: p.seat,
        team: p.team,
        hand: sortStandardHand(p.hand),
        bid: p.bid,
        tricksWon: p.tricksWon,
      },
      isYourTurn,
      turnDeadline: state.turn.deadline,
      actions: {
        canBid,
        minBid: state.config.allowNil ? 0 : 1,
        maxBid: HAND_SIZE,
        allowNil: state.config.allowNil,
        canPlay,
        playableCardIds: canPlay ? legalPlays(state, p).map((c) => c.id) : [],
      },
      table: buildPublicView(state, players),
    };
  },

  serializeState(state) {
    return JSON.stringify(state);
  },

  deserializeState(raw) {
    return JSON.parse(raw) as SpadesState;
  },
};

export default SpadesEngine;

// Exported for unit tests.
export const _internal = {
  legalPlays,
  trickWinner,
  dealRound,
  HAND_SIZE,
  cardsOfSuit,
};
