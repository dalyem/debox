"use client";

import { motion } from "framer-motion";
import type { Card } from "@/lib/cards";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";

/** Face-down draw pile with a depth stack + remaining count. */
export function DrawPileStack({
  count,
  size = "lg",
  label = "Draw",
  className,
}: {
  count: number;
  size?: "md" | "lg" | "xl";
  label?: string;
  className?: string;
}) {
  const depth = Math.min(4, Math.max(1, Math.ceil(count / 18)));
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative">
        {Array.from({ length: depth }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{ top: -i * 2, left: i * 2 }}
            aria-hidden
          >
            <PlayingCard
              card={{ id: `back-${i}`, kind: "number", color: "blue", value: 0 }}
              size={size}
              faceDown
            />
          </div>
        ))}
        <div style={{ visibility: "hidden" }}>
          <PlayingCard
            card={{ id: "spacer", kind: "number", color: "blue", value: 0 }}
            size={size}
            faceDown
          />
        </div>
      </div>
      <div className="text-center">
        <div className="font-display text-sm text-haze">{label}</div>
        <div className="font-display text-lg font-bold tabular-nums">{count}</div>
      </div>
    </div>
  );
}

/** Discard pile showing the live top card. */
export function DiscardPileStack({
  top,
  count,
  size = "lg",
  label = "Discard",
  className,
}: {
  top: Card | null;
  count: number;
  size?: "md" | "lg" | "xl";
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {top ? (
        <motion.div
          key={top.id}
          initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
        >
          <PlayingCard card={top} size={size} />
        </motion.div>
      ) : (
        <div
          className={cn(
            "rounded-xl border-2 border-dashed border-white/20",
            size === "xl" ? "h-44" : size === "lg" ? "h-32" : "h-24",
          )}
          style={{ aspectRatio: "5 / 7" }}
        />
      )}
      <div className="text-center">
        <div className="font-display text-sm text-haze">{label}</div>
        <div className="font-display text-lg font-bold tabular-nums">{count}</div>
      </div>
    </div>
  );
}
