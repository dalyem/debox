"use client";

import { motion } from "framer-motion";
import { Crown, Snowflake } from "lucide-react";
import type {
  PublicGameView,
  PublicPlayerView,
} from "@/lib/games/phase-cards/types";
import { Avatar } from "@/components/platform/Avatar";
import { PlayingCard } from "./PlayingCard";
import { MeldRow } from "./MeldRow";
import { DiscardPileStack, DrawPileStack } from "./Piles";
import { PhaseLadder } from "./PhaseLadder";
import { cn } from "@/lib/utils";

function HandStack({ count }: { count: number }) {
  const shown = Math.min(count, 8);
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {Array.from({ length: shown }).map((_, i) => (
          <PlayingCard
            key={i}
            card={{ id: `h-${i}`, kind: "number", color: "blue", value: 0 }}
            size="xs"
            faceDown
            className={i > 0 ? "-ml-3" : ""}
          />
        ))}
      </div>
      <span className="font-display text-sm font-bold tabular-nums text-haze">
        {count}
      </span>
    </div>
  );
}

function TvSeat({ p, active }: { p: PublicPlayerView; active: boolean }) {
  return (
    <motion.div
      layout
      animate={{ scale: active ? 1.03 : 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "relative flex flex-col gap-3 rounded-3xl border p-4 transition-colors",
        active
          ? "border-gold/60 bg-gold/10 shadow-[0_0_40px_-8px_rgba(251,191,36,0.5)]"
          : "border-white/10 bg-white/[0.03]",
        !p.isActive && "opacity-60",
      )}
    >
      {active ? (
        <motion.span
          layoutId="turn-flag"
          className="absolute -top-3 left-4 rounded-full bg-gold px-3 py-0.5 text-xs font-bold text-[#3a2400] shadow"
        >
          NOW PLAYING
        </motion.span>
      ) : null}

      <div className="flex items-center gap-3">
        <Avatar color={p.avatar.color} emoji={p.avatar.emoji} size="lg" active={p.isActive} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-xl font-bold">
              {p.displayName}
            </span>
            {p.finishedLadder ? <Crown className="size-5 shrink-0 text-gold" /> : null}
          </div>
          <div className="text-sm text-haze">
            {p.finishedLadder ? "Champion" : `Phase ${p.phaseIndex} · ${p.phaseName}`}
          </div>
          <PhaseLadder phaseIndex={p.phaseIndex} className="mt-1.5" />
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold tabular-nums">{p.score}</div>
          <div className="text-[0.65rem] uppercase tracking-widest text-haze">pts</div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <HandStack count={p.handCount} />
        {p.completedPhase ? (
          <span className="chip border-lime/40 bg-lime/15 text-lime">Down ✓</span>
        ) : (
          <span className="chip text-haze">In hand</span>
        )}
      </div>

      {p.laidGroups.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl bg-black/20 p-2">
          {p.laidGroups.map((g, i) => (
            <MeldRow key={i} group={g} size="xs" />
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

export function PhaseCardsTV({ view }: { view: PublicGameView }) {
  const current = view.players.find((p) => p.playerId === view.currentPlayerId);

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 pb-8">
      {/* Center table: turn spotlight + piles */}
      <div className="grid items-center gap-6 rounded-[2rem] border border-white/10 bg-black/20 p-6 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-4">
          {current ? (
            <>
              <motion.div
                key={current.playerId}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 24 }}
              >
                <Avatar
                  color={current.avatar.color}
                  emoji={current.avatar.emoji}
                  size="xl"
                />
              </motion.div>
              <div>
                <div className="text-sm uppercase tracking-[0.25em] text-haze">
                  Round {view.round} · It&apos;s
                </div>
                <div className="font-display text-4xl font-bold text-glow">
                  {current.displayName}
                </div>
                <div className="text-haze">
                  {current.finishedLadder
                    ? "Champion"
                    : `chasing ${current.phaseName}`}
                </div>
              </div>
            </>
          ) : (
            <div className="font-display text-3xl">Get ready…</div>
          )}
        </div>

        <div className="flex items-start justify-center gap-8">
          <DrawPileStack count={view.drawCount} size="lg" />
          <DiscardPileStack top={view.discardTop} count={view.discardCount} size="lg" />
        </div>

        <div className="hidden flex-col items-end gap-2 lg:flex">
          <div className="chip text-haze">
            {view.direction === 1 ? "Play ↻ clockwise" : "Play ↺ counter-clockwise"}
          </div>
          <div className="flex items-center gap-2 text-haze">
            <Snowflake className="size-4 text-lagoon" />
            <span className="text-sm">Freeze = skip a turn</span>
          </div>
        </div>
      </div>

      {/* Players */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {view.players.map((p) => (
          <TvSeat
            key={p.playerId}
            p={p}
            active={p.playerId === view.currentPlayerId}
          />
        ))}
      </div>
    </div>
  );
}
