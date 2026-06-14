import { PlayingCard } from "./PlayingCard";
import type { LaidGroup } from "@/lib/games/phase-cards/types";
import { cn } from "@/lib/utils";

/** Renders a laid-down meld as a tight overlapping fan of cards. */
export function MeldRow({
  group,
  size = "sm",
  className,
}: {
  group: LaidGroup;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center", className)} title={group.label}>
      {group.cards.map((card, i) => (
        <PlayingCard
          key={card.id}
          card={card}
          size={size}
          className={i > 0 ? "-ml-3.5" : ""}
        />
      ))}
    </div>
  );
}
