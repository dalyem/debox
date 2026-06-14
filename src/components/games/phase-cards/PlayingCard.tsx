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
const CORNER_GLYPH: Record<string, string> = {
  xs: "text-[0.6rem]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-xl",
};
const CENTER_SIZE: Record<string, string> = {
  md: "text-4xl",
  lg: "text-5xl",
  xl: "text-7xl",
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
  const showCenter = size === "md" || size === "lg" || size === "xl";

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
      {/* Corner identifier (top-left) */}
      <span className="absolute left-1 top-0.5 flex flex-col items-center font-bold leading-none">
        <span className={CORNER_VALUE[size]}>{corner}</span>
        <span className={cn("opacity-90 leading-none", CORNER_GLYPH[size])}>
          {face.glyph}
        </span>
      </span>

      {/* Center accent (larger cards only) */}
      {showCenter ? (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold opacity-90",
            CENTER_SIZE[size],
          )}
          style={{ textShadow: "0 2px 6px rgba(0,0,0,0.25)" }}
        >
          {isNumber ? card.value : face.glyph}
        </span>
      ) : null}

      {/* Label for wild/freeze (larger cards only) */}
      {!isNumber && showCenter ? (
        <span className="absolute inset-x-0 bottom-1 text-center text-[0.6rem] font-extrabold uppercase tracking-widest opacity-90">
          {face.label}
        </span>
      ) : null}
    </Comp>
  );
}
