"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import type { Card } from "@/lib/cards";
import { faceOf } from "@/lib/design/cards";
import { cn } from "@/lib/utils";

const HEIGHTS: Record<string, string> = {
  xs: "h-12",
  sm: "h-16",
  md: "h-24",
  lg: "h-32",
  xl: "h-44",
};

const VALUE_SIZE: Record<string, string> = {
  xs: "text-[0.6rem]",
  sm: "text-xs",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
};

const GLYPH_SIZE: Record<string, string> = {
  xs: "text-lg",
  sm: "text-2xl",
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
        <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-70">
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
      whileTap={interactive ? { scale: 0.94 } : undefined}
      animate={{ y: selected ? -14 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "relative flex shrink-0 select-none flex-col justify-between overflow-hidden rounded-xl border-2 p-1.5 font-bold leading-none shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)]",
        interactive && "cursor-pointer",
        selected ? "border-white ring-2 ring-white/80" : "border-white/70",
        dimmed && "opacity-40 saturate-50",
        VALUE_SIZE[size],
        HEIGHTS[size],
        className,
      )}
      style={{
        aspectRatio: "5 / 7",
        background: `linear-gradient(155deg, ${face.from}, ${face.to})`,
        color: face.text,
        ...style,
      }}
    >
      <span className="flex flex-col items-center self-start leading-none">
        <span>{corner}</span>
        {isNumber ? <span className="opacity-90">{face.glyph}</span> : null}
      </span>

      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          GLYPH_SIZE[size],
        )}
        style={{ textShadow: "0 2px 6px rgba(0,0,0,0.25)" }}
      >
        {isNumber ? card.value : face.glyph}
      </span>

      {!isNumber ? (
        <span className="absolute inset-x-0 bottom-1 text-center text-[0.55em] font-extrabold uppercase tracking-widest opacity-90">
          {face.label}
        </span>
      ) : (
        <span className="flex rotate-180 flex-col items-center self-start leading-none">
          <span>{corner}</span>
          <span className="opacity-90">{face.glyph}</span>
        </span>
      )}
    </Comp>
  );
}
