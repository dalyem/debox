"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import type { Card } from "@/lib/cards";
import { faceOf } from "@/lib/design/cards";
import { cn } from "@/lib/utils";

const HEIGHTS: Record<string, string> = {
  xs: "h-14",
  sm: "h-16",
  md: "h-24",
  lg: "h-32",
  xl: "h-44",
};

// The corner identifier (value + suit) is the primary readout — it's the part
// that stays visible when cards overlap in a meld/fan.
const CORNER_VALUE: Record<string, string> = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-3xl",
};
// The suit/kind symbol, shown in the bottom-left (mirrors the top-left value
// like a real card) instead of a big center glyph that crowded the numbers.
const SYMBOL_SIZE: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-4xl",
};

export interface PlayingCardProps {
  card: Card;
  size?: keyof typeof HEIGHTS;
  selected?: boolean;
  dimmed?: boolean;
  faceDown?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function PlayingCard({
  card,
  size = "md",
  selected = false,
  dimmed = false,
  faceDown = false,
  disabled = false,
  onClick,
  className,
  style,
}: PlayingCardProps) {
  const face = faceOf(card);
  const interactive = !!onClick && !disabled;
  const isNumber = card.kind === "number";
  const corner = isNumber ? String(card.value) : face.glyph;
  const showLabel = size === "md" || size === "lg" || size === "xl";

  if (faceDown) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl border-2 border-white/30",
          HEIGHTS[size],
          className,
        )}
        style={{ aspectRatio: "5 / 7", ...style }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(135deg,#3b2a72 0 10px,#241a4d 10px 20px)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xl opacity-70">
          🎴
        </div>
      </div>
    );
  }

  const Comp = interactive ? motion.button : motion.div;

  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={interactive ? disabled : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={
        isNumber ? `${face.label} ${card.value}` : face.label
      }
      whileTap={interactive ? { scale: 0.94 } : undefined}
      animate={{ y: selected ? -14 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "relative shrink-0 select-none overflow-hidden rounded-xl border-2 shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)]",
        interactive && "cursor-pointer",
        selected ? "border-white ring-2 ring-white/80" : "border-white/70",
        dimmed && "opacity-40 saturate-50",
        HEIGHTS[size],
        className,
      )}
      style={{
        aspectRatio: "5 / 7",
        background: `linear-gradient(160deg, ${face.from}, ${face.to})`,
        color: face.text,
        ...style,
      }}
    >
      {/* Primary readout (top-left) — value for numbers, glyph for wild/freeze */}
      <span
        className={cn(
          "absolute left-1.5 top-1 font-bold leading-none",
          CORNER_VALUE[size],
        )}
      >
        {corner}
      </span>

      {/* Suit/kind symbol (bottom-left) */}
      <span
        className={cn(
          "absolute bottom-1 left-1.5 font-bold leading-none opacity-90",
          SYMBOL_SIZE[size],
        )}
      >
        {face.glyph}
      </span>

      {/* Name for wild/freeze (larger cards only) */}
      {!isNumber && showLabel ? (
        <span className="absolute inset-y-0 right-1.5 flex items-center text-[0.6rem] font-extrabold uppercase tracking-widest opacity-90 [writing-mode:vertical-rl]">
          {face.label}
        </span>
      ) : null}
    </Comp>
  );
}
