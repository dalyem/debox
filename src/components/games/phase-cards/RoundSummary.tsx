"use client";

import { motion } from "framer-motion";
import { ArrowRight, Flag } from "lucide-react";
import type { RoundSummary as RoundSummaryData } from "@/lib/games/phase-cards/types";
import type { PublicPlayerView } from "@/lib/games/phase-cards/types";
import { Avatar } from "@/components/platform/Avatar";
import { cn } from "@/lib/utils";

export function RoundSummary({
  summary,
  players,
}: {
  summary: RoundSummaryData;
  players: PublicPlayerView[];
}) {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const rows = [...summary.players].sort(
    (a, b) => Number(b.advanced) - Number(a.advanced) || a.pointsAdded - b.pointsAdded,
  );

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
        className="surface-pop w-[min(92vw,40rem)] p-7"
      >
        <div className="text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-haze">
            Round {summary.round} complete
          </div>
          <h2 className="font-display text-3xl font-bold text-glow">Scoreboard</h2>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {rows.map((r, i) => {
            const p = byId.get(r.playerId);
            return (
              <motion.div
                key={r.playerId}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3",
                  r.wentOut
                    ? "border-lime/40 bg-lime/10"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <Avatar
                  color={p?.avatar.color ?? "slate"}
                  emoji={p?.avatar.emoji ?? "🙂"}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {p?.displayName ?? "Player"}
                    {r.wentOut ? (
                      <span className="inline-flex items-center gap-1 text-xs text-lime">
                        <Flag className="size-3" /> went out
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-haze">
                    Phase {r.phaseBefore}
                    {r.advanced ? (
                      <>
                        <ArrowRight className="size-3.5 text-lime" />
                        <span className="font-semibold text-lime">
                          {r.phaseAfter > 10 ? "Champion" : r.phaseAfter}
                        </span>
                      </>
                    ) : (
                      <span className="text-coral">· stays</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold tabular-nums">
                    +{r.pointsAdded}
                  </div>
                  <div className="text-[0.65rem] uppercase tracking-widest text-haze">
                    {r.totalScore} total
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-5 text-center text-sm text-haze">Next round dealing…</p>
      </motion.div>
    </motion.div>
  );
}
