"use client";

import { useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Crown } from "lucide-react";
import type { GameResult } from "@/lib/games/types";
import { Avatar } from "@/components/platform/Avatar";
import { paletteOf } from "@/lib/design/palette";
import { cn } from "@/lib/utils";

/** Minimal player shape the winner screen needs — game-agnostic. */
interface VictoryPlayer {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
}

function fireConfetti() {
  const end = Date.now() + 1400;
  const colors = ["#a78bfa", "#22d3ee", "#f472b6", "#fbbf24", "#a3e635"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/**
 * The shared full-screen winner celebration for the TV. Works for any game: it
 * reads only the game-agnostic `GameResult` (winners + standings) plus a roster
 * for avatars/names. A game may pass a custom `winnerLabel`/`subtitle` to frame
 * the result (e.g. "Team A wins").
 */
export function Victory({
  result,
  players,
  actions,
  winnerLabel,
  subtitle,
}: {
  result: GameResult;
  players: VictoryPlayer[];
  actions?: ReactNode;
  winnerLabel?: string;
  subtitle?: string;
}) {
  const byId = new Map(players.map((p) => [p.playerId, p]));

  useEffect(() => {
    fireConfetti();
    const t = setInterval(fireConfetti, 2600);
    return () => clearInterval(t);
  }, []);

  const winner = byId.get(result.winners[0] ?? "");
  const winnerSwatch = paletteOf(winner?.avatar.color ?? "gold");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-10">
      <motion.div
        initial={{ scale: 0.3, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className="text-center"
      >
        <div className="font-display text-xl uppercase tracking-[0.4em] text-gold">Winner</div>
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="relative mx-auto mt-4 w-fit"
        >
          <Crown className="absolute -top-9 left-1/2 size-12 -translate-x-1/2 text-gold drop-shadow" />
          <Avatar
            color={winner?.avatar.color ?? "gold"}
            emoji={winner?.avatar.emoji ?? "🏆"}
            size="xl"
            className="!size-36 !text-7xl"
          />
        </motion.div>
        <h1 className="mt-5 font-display text-6xl font-bold" style={{ color: winnerSwatch.bright }}>
          {winnerLabel ?? winner?.displayName ?? "Champion"}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-haze">{subtitle}</p>
        ) : result.winners.length > 1 ? (
          <p className="mt-2 text-haze">
            Tied with{" "}
            {result.winners
              .slice(1)
              .map((id) => byId.get(id)?.displayName ?? "Player")
              .join(", ")}
          </p>
        ) : null}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-[min(92vw,34rem)]"
      >
        <div className="mb-2 text-center text-sm uppercase tracking-[0.3em] text-haze">
          Final standings
        </div>
        <div className="flex flex-col gap-2">
          {result.standings.map((s) => {
            const p = byId.get(s.playerId);
            return (
              <div
                key={s.playerId}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-2.5",
                  s.rank === 1
                    ? "border-gold/50 bg-gold/10"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <span className="w-6 text-center font-display text-lg font-bold tabular-nums text-haze">
                  {s.rank}
                </span>
                <Avatar color={p?.avatar.color ?? "slate"} emoji={p?.avatar.emoji ?? "🙂"} size="sm" />
                <span className="flex-1 font-semibold">{p?.displayName ?? "Player"}</span>
                <span className="text-sm text-haze">{s.detail}</span>
                <span className="font-display text-lg font-bold tabular-nums">{s.score}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {actions}
    </div>
  );
}
