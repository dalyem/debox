import { TOTAL_PHASES } from "@/lib/games/phase-cards/phases";
import { cn } from "@/lib/utils";

/** Compact 1→10 progress pips for a player's climb up the phase ladder. */
export function PhaseLadder({
  phaseIndex,
  className,
}: {
  phaseIndex: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: TOTAL_PHASES }).map((_, i) => {
        const n = i + 1;
        const done = n < phaseIndex;
        const current = n === phaseIndex;
        return (
          <span
            key={n}
            className={cn(
              "h-1.5 rounded-full transition-all",
              done ? "w-1.5 bg-lime" : current ? "w-4 bg-gold" : "w-1.5 bg-white/15",
            )}
          />
        );
      })}
    </div>
  );
}
