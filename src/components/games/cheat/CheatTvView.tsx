"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import type { PublicCheatPlayer, PublicCheatView } from "@/lib/games/cheat/types";
import type { GameTvProps } from "@/components/games/registry";
import { Avatar } from "@/components/platform/Avatar";
import { CardBack } from "@/components/games/shared/StandardCardFace";
import { CheatRevealOverlay } from "./CheatRevealOverlay";
import { cn } from "@/lib/utils";

function Pile({ size }: { size: number }) {
  const shown = Math.min(size, 12);
  return (
    <div className="relative h-40 w-32">
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%,-50%) rotate(${((i * 37) % 24) - 12}deg) translateY(${-i * 0.5}px)`,
          }}
        >
          <CardBack size="lg" />
        </div>
      ))}
      {size === 0 ? (
        <div className="absolute inset-0 grid place-items-center rounded-xl border-2 border-dashed border-white/15 text-sm text-haze">
          empty
        </div>
      ) : null}
      <motion.div
        key={size}
        initial={{ scale: 1.4 }}
        animate={{ scale: 1 }}
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-3 px-3 py-1 font-display text-lg font-bold tabular-nums shadow"
      >
        {size}
      </motion.div>
    </div>
  );
}

function PlayerChip({ p }: { p: PublicCheatPlayer }) {
  return (
    <motion.div
      layout
      animate={{ scale: p.isCurrent ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "relative flex flex-col items-center gap-1.5 rounded-2xl border p-3",
        p.isCurrent
          ? "border-gold/60 bg-gold/10 shadow-[0_0_30px_-8px_rgba(251,191,36,0.6)]"
          : "border-white/10 bg-white/[0.03]",
        !p.isActive && "opacity-60",
        p.handCount === 0 && "border-lime/50 bg-lime/10",
      )}
    >
      {p.isCurrent ? (
        <motion.span
          layoutId="cheat-turn-flag"
          className="absolute -top-2.5 rounded-full bg-gold px-2 py-0.5 text-[0.6rem] font-bold text-[#3a2400]"
        >
          PLAYING
        </motion.span>
      ) : null}
      <Avatar color={p.avatar.color} emoji={p.avatar.emoji} size="lg" active={p.isActive} />
      <span className="max-w-24 truncate text-sm font-semibold">{p.displayName}</span>
      <span className="chip text-xs">
        {p.handCount === 0 ? "🎉 out!" : `${p.handCount} cards`}
      </span>
    </motion.div>
  );
}

/** Cheat TV board — the claim, the growing pile, card counts, and reveals. */
export function CheatTvView({ view }: GameTvProps) {
  const v = view as PublicCheatView;
  const nameOf = (id: string) => v.players.find((p) => p.playerId === id)?.displayName ?? "Player";
  const current = v.players.find((p) => p.playerId === v.currentPlayerId);

  return (
    <div className="relative flex flex-1 flex-col gap-6 px-6 pb-8">
      {/* Required rank + current player */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-sm uppercase tracking-[0.3em] text-haze">Now playing</div>
        <div className="flex items-center gap-3">
          {current ? (
            <Avatar color={current.avatar.color} emoji={current.avatar.emoji} size="lg" />
          ) : null}
          <div className="text-left">
            <div className="font-display text-3xl font-bold text-glow">
              {current?.displayName ?? "…"}
            </div>
            <div className="text-haze">
              must claim{" "}
              <span className="font-bold text-cream">{v.requiredRankLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pile + last claim */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <Pile size={v.pileSize} />
        <AnimatePresence mode="wait">
          {v.lastClaim ? (
            <motion.div
              key={`${v.lastClaim.playerId}-${v.pileSize}`}
              initial={{ y: -16, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="surface flex items-center gap-2 px-5 py-2.5"
            >
              <span className="font-display text-lg font-bold">
                {nameOf(v.lastClaim.playerId)}
              </span>
              <span className="text-haze">claims</span>
              <span className="font-display text-lg font-bold text-grape-bright">
                {v.lastClaim.count} {v.lastClaim.claimedRankLabel}
              </span>
            </motion.div>
          ) : (
            <div className="text-haze">Waiting for the first play…</div>
          )}
        </AnimatePresence>
        {v.canBeChallenged ? (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="text-sm text-haze"
          >
            …anyone smell a bluff? 👀
          </motion.div>
        ) : null}
      </div>

      {/* Players */}
      <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {v.players.map((p) => (
          <PlayerChip key={p.playerId} p={p} />
        ))}
      </div>

      {v.winnerId ? (
        <div className="flex items-center justify-center gap-2 text-gold">
          <Crown className="size-5" /> {nameOf(v.winnerId)} emptied their hand!
        </div>
      ) : null}

      <CheatRevealOverlay challenge={v.lastChallenge} nameOf={nameOf} />
    </div>
  );
}
