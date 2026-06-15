"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crown, Spade } from "lucide-react";
import { suitSymbol } from "@/lib/cards/standard";
import type {
  PublicSpadesPlayer,
  PublicSpadesView,
  SpadesRoundSummary,
  TeamId,
} from "@/lib/games/spades/types";
import type { GameTvProps } from "@/components/games/registry";
import { Avatar } from "@/components/platform/Avatar";
import { StandardCardFace } from "@/components/games/shared/StandardCardFace";
import { cn } from "@/lib/utils";

const TEAM_NAME: Record<TeamId, string> = { 0: "Team A", 1: "Team B" };
const TEAM_CLASS: Record<TeamId, string> = {
  0: "border-lagoon/50 bg-lagoon/10",
  1: "border-coral/50 bg-coral/10",
};
const TEAM_TEXT: Record<TeamId, string> = { 0: "text-lagoon", 1: "text-coral" };

function TeamPanel({
  view,
  team,
}: {
  view: PublicSpadesView;
  team: TeamId;
}) {
  const t = view.teams[team];
  const members = view.players.filter((p) => p.team === team);
  return (
    <div className={cn("flex flex-col gap-2 rounded-3xl border p-4", TEAM_CLASS[team])}>
      <div className="flex items-baseline justify-between">
        <span className={cn("font-display text-xl font-bold", TEAM_TEXT[team])}>
          {TEAM_NAME[team]}
        </span>
        <span className="font-display text-3xl font-bold tabular-nums">{t.score}</span>
      </div>
      <div className="flex items-center justify-between text-sm text-haze">
        <span>{members.map((m) => m.displayName).join(" & ")}</span>
        <span className="chip">🛍️ {t.bags % 10} bags</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="chip">
          Bid {t.bid ?? "—"}
        </span>
        <span className="chip">Tricks {t.tricks}</span>
      </div>
    </div>
  );
}

function Seat({ p, current }: { p: PublicSpadesPlayer; current: boolean }) {
  return (
    <motion.div
      layout
      animate={{ scale: current ? 1.04 : 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "relative flex items-center gap-3 rounded-2xl border p-3",
        current
          ? "border-gold/60 bg-gold/10 shadow-[0_0_36px_-10px_rgba(251,191,36,0.6)]"
          : "border-white/10 bg-white/[0.03]",
        !p.isActive && "opacity-60",
      )}
    >
      {current ? (
        <motion.span
          layoutId="spades-turn-flag"
          className="absolute -top-2.5 left-3 rounded-full bg-gold px-2 py-0.5 text-[0.6rem] font-bold text-[#3a2400]"
        >
          NOW
        </motion.span>
      ) : null}
      <Avatar color={p.avatar.color} emoji={p.avatar.emoji} size="md" active={p.isActive} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{p.displayName}</div>
        <div className={cn("text-xs font-semibold", TEAM_TEXT[p.team])}>{TEAM_NAME[p.team]}</div>
      </div>
      <div className="text-right">
        <div className="font-display text-lg font-bold tabular-nums">
          {p.tricksWon}
          <span className="text-xs text-haze">/{p.bid ?? "–"}</span>
        </div>
        <div className="text-[0.6rem] uppercase tracking-widest text-haze">won/bid</div>
      </div>
    </motion.div>
  );
}

function TrickArea({ view }: { view: PublicSpadesView }) {
  const plays = view.trick.plays;
  const nameOf = (id: string) => view.players.find((p) => p.playerId === id)?.displayName ?? "";
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-white/10 bg-black/25 p-6">
      {view.phase === "bidding" ? (
        <div className="text-center">
          <div className="font-display text-3xl font-bold text-glow">Bidding</div>
          <p className="text-haze">Players are calling their tricks…</p>
        </div>
      ) : plays.length === 0 ? (
        <div className="text-center text-haze">
          {view.lastTrickWinnerId ? `${nameOf(view.lastTrickWinnerId)} leads…` : "Leading off…"}
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-center gap-4">
          <AnimatePresence>
            {plays.map((pl) => (
              <motion.div
                key={pl.playerId}
                initial={{ y: -30, opacity: 0, scale: 0.7 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="flex flex-col items-center gap-1"
              >
                <StandardCardFace card={pl.card} size="lg" />
                <span className="text-xs text-haze">{nameOf(pl.playerId)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function RoundSummaryOverlay({
  summary,
  view,
}: {
  summary: SpadesRoundSummary;
  view: PublicSpadesView;
}) {
  const nameOf = (id: string) => view.players.find((p) => p.playerId === id)?.displayName ?? "Player";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.85, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="surface-pop w-[min(92vw,42rem)] p-7"
      >
        <div className="text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-haze">
            Round {summary.round} complete
          </div>
          <h2 className="font-display text-3xl font-bold text-glow">Scoreboard</h2>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {summary.teams.map((t) => (
            <div key={t.team} className={cn("rounded-2xl border p-4", TEAM_CLASS[t.team])}>
              <div className="flex items-baseline justify-between">
                <span className={cn("font-display text-lg font-bold", TEAM_TEXT[t.team])}>
                  {TEAM_NAME[t.team]}
                </span>
                <span
                  className={cn(
                    "font-display text-xl font-bold tabular-nums",
                    t.roundDelta >= 0 ? "text-lime" : "text-coral",
                  )}
                >
                  {t.roundDelta >= 0 ? "+" : ""}
                  {t.roundDelta}
                </span>
              </div>
              <div className="mt-1 text-sm text-haze">
                Bid {t.bid} · took {t.tricks} · {t.madeContract ? "made it ✓" : "set ✗"}
              </div>
              {t.bagPenalty < 0 ? (
                <div className="text-sm text-coral">Bag penalty {t.bagPenalty}</div>
              ) : null}
              {t.nil.map((n) => (
                <div key={n.playerId} className="text-sm">
                  {nameOf(n.playerId)} nil {n.made ? "made 🥶" : "busted 💥"}
                </div>
              ))}
              <div className="mt-2 font-display text-2xl font-bold tabular-nums">{t.scoreAfter}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-haze">Next hand dealing…</p>
      </motion.div>
    </motion.div>
  );
}

/** Spades TV board — teams, the trick, bids and seating. */
export function SpadesTvView({ view }: GameTvProps) {
  const v = view as PublicSpadesView;
  const ledSuit = v.trick.ledSuit;

  return (
    <div className="relative flex flex-1 flex-col gap-5 px-6 pb-8">
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-haze">
        <span className="chip">Round {v.round}</span>
        <span className="chip">First to {v.targetScore}</span>
        <span className={cn("chip", v.spadesBroken ? "border-gold/40 text-gold" : "")}>
          <Spade className="size-3.5" /> {v.spadesBroken ? "Spades broken" : "Spades unbroken"}
        </span>
        {v.phase === "playing" && ledSuit ? (
          <span className="chip">Lead {suitSymbol(ledSuit)}</span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TeamPanel view={v} team={0} />
        <TeamPanel view={v} team={1} />
      </div>

      <TrickArea view={v} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {v.players.map((p) => (
          <Seat key={p.playerId} p={p} current={p.playerId === v.currentPlayerId} />
        ))}
      </div>

      {v.winnerTeam !== null ? (
        <div className="flex items-center justify-center gap-2 text-gold">
          <Crown className="size-5" /> {TEAM_NAME[v.winnerTeam]} wins!
        </div>
      ) : null}

      <AnimatePresence>
        {v.status === "round_over" && v.lastRoundSummary ? (
          <RoundSummaryOverlay summary={v.lastRoundSummary} view={v} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
