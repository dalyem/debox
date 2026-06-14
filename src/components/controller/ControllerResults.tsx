"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import type { GameResult } from "@/lib/games/types";
import { Avatar } from "@/components/platform/Avatar";
import { cn } from "@/lib/utils";

interface RosterPlayer {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
}

export function ControllerResults({
  result,
  players,
  youId,
  actions,
}: {
  result: GameResult;
  players: RosterPlayer[];
  youId: string;
  actions?: ReactNode;
}) {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const mine = result.standings.find((s) => s.playerId === youId);
  const won = result.winners.includes(youId);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-6 overflow-y-auto px-5 py-8">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
        className="text-center"
      >
        <div className="text-5xl">{won ? "🏆" : mine?.rank === 2 ? "🥈" : "🎉"}</div>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {won ? "You won!" : `You finished #${mine?.rank ?? "-"}`}
        </h1>
        {mine ? (
          <p className="text-haze">
            {mine.detail} · {mine.score} pts
          </p>
        ) : null}
      </motion.div>

      <div className="w-full max-w-sm">
        <div className="mb-2 text-center text-xs uppercase tracking-[0.25em] text-haze">
          Final standings
        </div>
        <div className="flex flex-col gap-2">
          {result.standings.map((s) => {
            const p = byId.get(s.playerId);
            const isYou = s.playerId === youId;
            return (
              <div
                key={s.playerId}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                  s.rank === 1
                    ? "border-gold/50 bg-gold/10"
                    : isYou
                      ? "border-grape/50 bg-grape/10"
                      : "border-white/10 bg-white/[0.03]",
                )}
              >
                <span className="w-5 text-center font-display font-bold tabular-nums text-haze">
                  {s.rank}
                </span>
                <Avatar
                  color={p?.avatar.color ?? "slate"}
                  emoji={p?.avatar.emoji ?? "🙂"}
                  size="sm"
                />
                <span className="flex-1 truncate font-semibold">
                  {p?.displayName ?? "Player"}
                  {isYou ? <span className="ml-1 text-xs text-grape-bright">(you)</span> : null}
                </span>
                {s.rank === 1 ? <Crown className="size-4 text-gold" /> : null}
                <span className="font-display font-bold tabular-nums">{s.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {actions ?? (
        <p className="text-center text-sm text-haze">
          Thanks for playing! The host will pick what&apos;s next — keep this
          screen open for a rematch.
        </p>
      )}
    </div>
  );
}
