"use client";

import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import type { Card } from "@/lib/cards";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";

/**
 * The player's hand as a bottom, overlapping fan you can drag to reorder —
 * anytime, even on someone else's turn, so you can organize while you wait.
 * Tap selects (for discard/hit); drag reorders. Local order is reconciled with
 * the server hand (new draws appended, played cards removed).
 */
export function FannedHand({
  cards,
  selectedId,
  dimmedIds,
  onTap,
  disabled = false,
  size = "lg",
}: {
  cards: Card[];
  selectedId?: string | null;
  dimmedIds?: Set<string>;
  onTap?: (id: string) => void;
  disabled?: boolean;
  size?: "md" | "lg";
}) {
  const [order, setOrder] = useState<Card[]>(cards);

  useEffect(() => {
    setOrder((prev) => {
      const byId = new Map(cards.map((c) => [c.id, c]));
      const kept = prev.filter((c) => byId.has(c.id)).map((c) => byId.get(c.id)!);
      const keptIds = new Set(kept.map((c) => c.id));
      const added = cards.filter((c) => !keptIds.has(c.id));
      return [...kept, ...added];
    });
  }, [cards]);

  return (
    <div className="overflow-x-auto pb-1 pt-3">
      <Reorder.Group
        axis="x"
        values={order}
        onReorder={setOrder}
        className="mx-auto flex w-max items-end px-4"
      >
        {order.map((card, i) => (
          <Reorder.Item
            key={card.id}
            value={card}
            className={cn(i > 0 && "-ml-5")}
            style={{ zIndex: selectedId === card.id ? 60 : i }}
            whileDrag={{ scale: 1.12, zIndex: 80, transition: { duration: 0.1 } }}
          >
            <PlayingCard
              card={card}
              size={size}
              selected={selectedId === card.id}
              dimmed={dimmedIds?.has(card.id)}
              onClick={disabled ? undefined : () => onTap?.(card.id)}
            />
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}
