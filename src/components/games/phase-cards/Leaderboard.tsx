"use client";

import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import type { PublicPlayerView } from "@/lib/games/phase-cards/types";
import { Avatar } from "@/components/platform/Avatar";
import { cn } from "@/lib/utils";

/** Standings sorted by ladder progress then score — used on the Scores tab and
 *  in the between-rounds interstitial. Always shows each player's phase. */
export function Leaderboard({
  players,
  youId,
  animate = false,
  className,
}: {
  players: PublicPlayerView[];
  youId: string;
  animate?: boolean;
  className?: string;
}) {
  const ranked = [...players].sort(
    (a, b) =>
      Number(b.finishedLadder) - Number(a.finishedLadder) ||
      b.phaseIndex - a.phaseIndex ||
      a.score - b.score,
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {ranked.map((p, i) => {
        const isYou = p.playerId === youId;
        return (
          <motion.div
            key={p.playerId}
            layout
            initial={animate ? { opacity: 0, x: -20 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: animate ? 0.05 * i : 0 }}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
              i === 0
                ? "border-gold/50 bg-gold/10"
                : isYou
                  ? "border-grape/40 bg-grape/10"
                  : "border-white/10 bg-white/[0.03]",
              !p.isActive && "opacity-60",
            )}
          >
            <span className="w-5 text-center font-display font-bold tabular-nums text-haze">
              {i + 1}
            </span>
            <Avatar
              color={p.avatar.color}
              emoji={p.avatar.emoji}
              size="sm"
              active={p.isActive}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {p.displayName}
                {isYou ? (
                  <span className="ml-1 text-xs text-grape-bright">(you)</span>
                ) : null}
              </div>
              <div className="truncate text-xs text-haze">
                {p.finishedLadder
                  ? "Reached the summit 👑"
                  : `Phase ${p.phaseIndex} · ${p.phaseName}`}
              </div>
            </div>
            {p.finishedLadder ? <Crown className="size-4 shrink-0 text-gold" /> : null}
            <div className="text-right">
              <div className="font-display text-lg font-bold tabular-nums">
                {p.score}
              </div>
              <div className="text-[0.6rem] uppercase tracking-widest text-haze">
                pts
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
