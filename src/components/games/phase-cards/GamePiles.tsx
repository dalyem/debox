"use client";

import { motion } from "framer-motion";
import type { Card } from "@/lib/cards";
import { PlayingCard } from "./PlayingCard";
import { useDropZone } from "./dnd";
import { cn } from "@/lib/utils";

const DECK_BACK: Card = { id: "deck-back", kind: "number", color: "blue", value: 0 };

/** The draw + discard piles. Tap a pile to draw; drag a card onto the discard. */
export function GamePiles({
  drawCount,
  discardTop,
  canDrawDeck,
  canTakeDiscard,
  canDiscard,
  onDrawDeck,
  onTakeDiscard,
  onDiscardCard,
}: {
  drawCount: number;
  discardTop: Card | null;
  canDrawDeck: boolean;
  canTakeDiscard: boolean;
  canDiscard: boolean;
  onDrawDeck: () => void;
  onTakeDiscard: () => void;
  onDiscardCard: (card: Card) => void;
}) {
  const { dropProps, active } = useDropZone(
    () => canDiscard,
    (card) => onDiscardCard(card),
  );

  return (
    <div className="flex items-start justify-center gap-10 py-1">
      {/* Draw pile */}
      <button
        type="button"
        disabled={!canDrawDeck}
        onClick={onDrawDeck}
        className="flex flex-col items-center gap-1.5 disabled:cursor-default"
      >
        <motion.div
          animate={canDrawDeck ? { y: [0, -5, 0] } : {}}
          transition={{ repeat: Infinity, duration: 1.6 }}
        >
          <PlayingCard
            card={DECK_BACK}
            size="md"
            faceDown
            className={cn(canDrawDeck && "ring-2 ring-grape-bright/70")}
          />
        </motion.div>
        <span className="text-xs text-haze">Deck · {drawCount}</span>
        <span className="h-3 text-[0.65rem] font-semibold text-grape-bright">
          {canDrawDeck ? "tap to draw" : ""}
        </span>
      </button>

      {/* Discard pile — tap to take, or drop a card to discard */}
      <div
        {...dropProps}
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-2xl p-1 transition",
          active && "scale-105 bg-coral/10 ring-2 ring-coral",
        )}
      >
        <button
          type="button"
          disabled={!canTakeDiscard}
          onClick={onTakeDiscard}
          className="disabled:cursor-default"
        >
          {discardTop ? (
            <PlayingCard
              card={discardTop}
              size="md"
              className={cn(canTakeDiscard && "ring-2 ring-lagoon/70")}
            />
          ) : (
            <div
              className="h-24 rounded-xl border-2 border-dashed border-white/20"
              style={{ aspectRatio: "5 / 7" }}
            />
          )}
        </button>
        <span className="text-xs text-haze">Discard</span>
        <span
          className={cn(
            "h-3 text-[0.65rem] font-semibold",
            canTakeDiscard ? "text-lagoon" : "text-coral",
          )}
        >
          {canTakeDiscard ? "tap to take" : canDiscard ? "drag here" : ""}
        </span>
      </div>
    </div>
  );
}
