"use client";

import { motion } from "framer-motion";
import type { Card } from "@/lib/cards";
import { PlayingCard } from "./PlayingCard";
import { useDropZone } from "./dnd";
import { useAnchor } from "./anchors";
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
  const deckRef = useAnchor("deck");
  const discardRef = useAnchor("discard");

  const bob = { y: [0, -5, 0] };
  const bobLoop = { repeat: Infinity, duration: 1.6 } as const;

  return (
    <div className="flex items-end justify-center gap-12 py-1">
      {/* Draw pile — bobs when it's your turn to draw; count shown as a badge. */}
      <button
        type="button"
        disabled={!canDrawDeck}
        onClick={onDrawDeck}
        className="relative disabled:cursor-default"
        aria-label={`Draw pile, ${drawCount} cards`}
      >
        <motion.div ref={deckRef} animate={canDrawDeck ? bob : {}} transition={bobLoop}>
          <PlayingCard
            card={DECK_BACK}
            size="md"
            faceDown
            className={cn(canDrawDeck && "ring-2 ring-grape-bright/70")}
          />
        </motion.div>
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-ink-2 px-2 py-0.5 text-[0.65rem] font-bold tabular-nums text-haze ring-1 ring-white/10">
          {drawCount}
        </span>
      </button>

      {/* Discard pile — bobs when you can take it, pulses a coral ring while
          waiting for your discard. Drop a card on it to discard. */}
      <motion.div
        {...dropProps}
        animate={
          active ? { scale: 1.06 } : canDiscard ? { scale: [1, 1.04, 1] } : { scale: 1 }
        }
        transition={
          canDiscard && !active ? bobLoop : { type: "spring", stiffness: 400, damping: 25 }
        }
        className={cn(
          "rounded-2xl p-1 transition-colors",
          active ? "bg-coral/15 ring-2 ring-coral" : canDiscard ? "ring-2 ring-coral/60" : "",
        )}
      >
        <motion.button
          ref={discardRef}
          type="button"
          disabled={!canTakeDiscard}
          onClick={onTakeDiscard}
          animate={canTakeDiscard ? bob : {}}
          transition={bobLoop}
          className="block disabled:cursor-default"
          aria-label="Discard pile"
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
        </motion.button>
      </motion.div>
    </div>
  );
}
