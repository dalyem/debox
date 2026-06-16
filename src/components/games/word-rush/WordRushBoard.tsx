"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { TileState } from "@/lib/games/word-rush/types";

/**
 * Word Rush — shared board primitives.
 *
 * Tiles, boards and the race countdown, reused by the TV (pattern-only, no
 * letters — so glancing at the shared screen can't spoil the word) and the
 * controller (your own letters + colours).
 */

export const TILE_COLOR: Record<TileState, string> = {
  correct: "bg-[#538d4e] border-[#538d4e] text-white",
  present: "bg-[#b59f3b] border-[#b59f3b] text-white",
  absent: "bg-[#3a3a3c] border-[#3a3a3c] text-white",
};

export type Cell =
  | { kind: "scored"; letter?: string; state: TileState }
  | { kind: "pending"; letter: string }
  | { kind: "empty" };

function Tile({ cell, size }: { cell: Cell; size: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg"
      ? "size-14 text-3xl sm:size-16 sm:text-4xl"
      : size === "md"
        ? "size-10 text-xl"
        : "size-5 text-[0]";
  const base =
    "grid place-items-center rounded-md border-2 font-display font-bold uppercase";

  if (cell.kind === "scored") {
    return (
      <motion.div
        initial={{ rotateX: 90, opacity: 0.4 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className={cn(base, dim, TILE_COLOR[cell.state])}
      >
        {cell.letter ?? ""}
      </motion.div>
    );
  }
  if (cell.kind === "pending") {
    return (
      <motion.div
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        className={cn(base, dim, "border-white/40 bg-white/5 text-cream")}
      >
        {cell.letter}
      </motion.div>
    );
  }
  return <div className={cn(base, dim, "border-white/10 bg-white/[0.02]")} />;
}

/** A full board: scored rows, an optional in-progress row, then empties. */
export function Board({
  rows,
  current,
  wordLength,
  maxGuesses,
  size = "lg",
}: {
  rows: { letters?: string[]; pattern: TileState[] }[];
  current?: string;
  wordLength: number;
  maxGuesses: number;
  size?: "sm" | "md" | "lg";
}) {
  const lines: Cell[][] = [];

  for (const row of rows) {
    lines.push(
      Array.from({ length: wordLength }, (_, i) => ({
        kind: "scored" as const,
        letter: row.letters?.[i],
        state: row.pattern[i] ?? "absent",
      })),
    );
  }

  if (current !== undefined && lines.length < maxGuesses) {
    const chars = current.toUpperCase().slice(0, wordLength).split("");
    lines.push(
      Array.from({ length: wordLength }, (_, i) =>
        chars[i] ? { kind: "pending" as const, letter: chars[i]! } : { kind: "empty" as const },
      ),
    );
  }

  while (lines.length < maxGuesses) {
    lines.push(Array.from({ length: wordLength }, () => ({ kind: "empty" as const })));
  }

  const gap = size === "sm" ? "gap-1" : "gap-1.5";
  return (
    <div className={cn("flex flex-col", gap)}>
      {lines.map((line, r) => (
        <div key={r} className={cn("flex", gap)}>
          {line.map((cell, c) => (
            <Tile key={c} cell={cell} size={size} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- countdown --- */

/** Ticking countdown to `deadline` (server wall-clock ms); null when inactive. */
export function useCountdown(deadline: number | null): {
  ms: number;
  label: string;
  active: boolean;
} {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline == null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);

  if (deadline == null) return { ms: 0, label: "0:00", active: false };
  const ms = Math.max(0, deadline - now);
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return { ms, label: `${m}:${String(s).padStart(2, "0")}`, active: true };
}

export function CountdownPill({
  deadline,
  className,
}: {
  deadline: number | null;
  className?: string;
}) {
  const { label, ms, active } = useCountdown(deadline);
  if (!active) return null;
  const urgent = ms <= 15_000;
  return (
    <motion.div
      animate={urgent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={urgent ? { repeat: Infinity, duration: 0.8 } : { duration: 0.2 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-display font-bold tabular-nums",
        urgent
          ? "border-coral/60 bg-coral/20 text-coral"
          : "border-gold/50 bg-gold/15 text-gold",
        className,
      )}
    >
      <span className="text-sm uppercase tracking-wide opacity-80">Lock in</span>
      <span className="text-lg">{label}</span>
    </motion.div>
  );
}
