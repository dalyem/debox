"use client";

import {
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion } from "framer-motion";
import {
  type StandardCard,
  isRed,
  rankLabel,
  suitSymbol,
} from "@/lib/cards/standard";
import { cn } from "@/lib/utils";

/**
 * A classic white-faced playing card for the standard 52-card games (Spades,
 * Cheat). Red pips for hearts/diamonds, near-black for clubs/spades — readable
 * at TV distance against the neon stage.
 */

const HEIGHTS: Record<string, string> = {
  xs: "h-12",
  sm: "h-16",
  md: "h-24",
  lg: "h-32",
  xl: "h-40",
};
const CORNER: Record<string, string> = {
  xs: "text-[0.6rem]",
  sm: "text-xs",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
};
const PIP: Record<string, string> = {
  xs: "text-lg",
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
  xl: "text-7xl",
};

const RED = "#dc2626";
const BLACK = "#0f172a";

export interface StandardCardFaceProps {
  card: StandardCard;
  size?: keyof typeof HEIGHTS;
  selected?: boolean;
  dimmed?: boolean;
  faceDown?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function CardBack({
  size = "md",
  className,
  style,
}: {
  size?: keyof typeof HEIGHTS;
  className?: string;
  style?: CSSProperties;
}) {
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
          background: "repeating-linear-gradient(135deg,#3b2a72 0 10px,#241a4d 10px 20px)",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-xl opacity-70">🂠</div>
    </div>
  );
}

export function StandardCardFace({
  card,
  size = "md",
  selected = false,
  dimmed = false,
  faceDown = false,
  disabled = false,
  onClick,
  className,
  style,
}: StandardCardFaceProps) {
  // Distinguish a tap from a scroll by movement, so selecting a card inside a
  // scrollable hand never gets eaten by the scroll container (and vice-versa).
  const downRef = useRef<{ x: number; y: number } | null>(null);

  if (faceDown) return <CardBack size={size} className={className} style={style} />;

  const ink = isRed(card.suit) ? RED : BLACK;
  const label = rankLabel(card.rank);
  const sym = suitSymbol(card.suit);
  const interactive = !!onClick && !disabled;
  const Comp = interactive ? motion.button : motion.div;

  const tapHandlers = interactive
    ? {
        onPointerDown: (e: ReactPointerEvent) => {
          downRef.current = { x: e.clientX, y: e.clientY };
        },
        onPointerUp: (e: ReactPointerEvent) => {
          const d = downRef.current;
          downRef.current = null;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 10) onClick?.();
        },
        onKeyDown: (e: ReactKeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        },
      }
    : {};

  return (
    <Comp
      type={interactive ? "button" : undefined}
      disabled={interactive ? disabled : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={`${label} of ${card.suit}`}
      whileTap={interactive ? { scale: 0.94 } : undefined}
      animate={{ y: selected ? -14 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      {...tapHandlers}
      className={cn(
        "relative shrink-0 select-none overflow-hidden rounded-xl border-2 bg-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)]",
        interactive && "cursor-pointer",
        selected ? "border-grape-bright ring-2 ring-grape-bright" : "border-black/10",
        dimmed && "opacity-40 saturate-50",
        HEIGHTS[size],
        className,
      )}
      style={{ aspectRatio: "5 / 7", color: ink, touchAction: "manipulation", ...style }}
    >
      <span className={cn("absolute left-1 top-0.5 font-bold leading-none", CORNER[size])}>
        {label}
        <span className="block leading-none">{sym}</span>
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-bold leading-none opacity-90",
          PIP[size],
        )}
      >
        {sym}
      </span>
      <span
        className={cn(
          "absolute bottom-0.5 right-1 rotate-180 font-bold leading-none",
          CORNER[size],
        )}
      >
        {label}
        <span className="block leading-none">{sym}</span>
      </span>
    </Comp>
  );
}
