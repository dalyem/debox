"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Card } from "@/lib/cards";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";

/**
 * The player's hand — a wrapping, touch-friendly row of cards. Selection and
 * disabled state are driven by the controller so the same hand serves both
 * "pick a card to discard/hit" and "build a phase" flows.
 */
export function Hand({
  cards,
  selectedIds,
  dimmedIds,
  onTap,
  disabled = false,
  size = "md",
  className,
}: {
  cards: Card[];
  selectedIds?: Set<string>;
  dimmedIds?: Set<string>;
  onTap?: (id: string) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-1.5",
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {cards.map((card) => (
          <motion.div
            key={card.id}
            layout
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: -20 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
          >
            <PlayingCard
              card={card}
              size={size}
              selected={selectedIds?.has(card.id)}
              dimmed={dimmedIds?.has(card.id)}
              disabled={disabled}
              onClick={onTap ? () => onTap(card.id) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
