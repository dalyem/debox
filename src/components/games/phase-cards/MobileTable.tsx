"use client";

import type { Card } from "@/lib/cards";
import type { PublicPlayerView } from "@/lib/games/phase-cards/types";
import { Avatar } from "@/components/platform/Avatar";
import { PlayingCard } from "./PlayingCard";
import { PhaseLadder } from "./PhaseLadder";
import { MeldRow } from "./MeldRow";
import { DrawPileStack } from "./Piles";
import { cn } from "@/lib/utils";

/**
 * The shared "table" rendered on a phone — the same public information a TV
 * shows (everyone's progress, the piles, whose turn), but never anyone's hand.
 * Used on every controller so phone-only games need no central screen.
 */
export function MobileTable({
  table,
  discardTop,
  drawCount,
  currentPlayerId,
  round,
  youId,
}: {
  table: PublicPlayerView[];
  discardTop: Card | null;
  drawCount: number;
  currentPlayerId: string;
  round: number;
  youId: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="text-center text-xs uppercase tracking-[0.25em] text-haze">
        Round {round} · the table
      </div>

      <div className="flex items-start justify-center gap-8">
        <DrawPileStack count={drawCount} size="md" />
        <div className="flex flex-col items-center gap-2">
          {discardTop ? (
            <PlayingCard card={discardTop} size="md" />
          ) : (
            <div
              className="h-24 rounded-xl border-2 border-dashed border-white/20"
              style={{ aspectRatio: "5 / 7" }}
            />
          )}
          <div className="font-display text-sm text-haze">Discard</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {table.map((p) => {
          const isCurrent = p.playerId === currentPlayerId;
          const isYou = p.playerId === youId;
          return (
            <div
              key={p.playerId}
              className={cn(
                "flex items-start gap-2.5 rounded-2xl border p-2.5",
                isCurrent
                  ? "border-gold/50 bg-gold/10"
                  : "border-white/10 bg-white/[0.03]",
                !p.isActive && "opacity-60",
              )}
            >
              <Avatar
                color={p.avatar.color}
                emoji={p.avatar.emoji}
                size="sm"
                active={p.isActive}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {p.displayName}
                    {isYou ? (
                      <span className="ml-1 text-xs text-grape-bright">(you)</span>
                    ) : null}
                  </span>
                  {isCurrent ? (
                    <span className="rounded-full bg-gold px-1.5 text-[0.6rem] font-bold text-[#3a2400]">
                      NOW
                    </span>
                  ) : null}
                  {p.completedPhase ? (
                    <span className="text-xs text-lime">✓ down</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-haze">
                  <span>
                    {p.finishedLadder ? "Champion" : `Phase ${p.phaseIndex}`}
                  </span>
                  <span>·</span>
                  <span>{p.handCount} cards</span>
                  <span>·</span>
                  <span>{p.score} pts</span>
                </div>
                <PhaseLadder phaseIndex={p.phaseIndex} className="mt-1" />
                {p.laidGroups.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
                    {p.laidGroups.map((g, i) => (
                      <MeldRow key={i} group={g} size="xs" />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
