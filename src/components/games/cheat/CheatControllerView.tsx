"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { type Rank, rankPlural } from "@/lib/cards/standard";
import type { CheatMove, PrivateCheatView } from "@/lib/games/cheat/types";
import type { GameControllerProps } from "@/components/games/registry";
import { Avatar } from "@/components/platform/Avatar";
import { StandardCardFace } from "@/components/games/shared/StandardCardFace";
import { Button } from "@/components/ui/button";
import { CheatRevealOverlay } from "./CheatRevealOverlay";
import { cn } from "@/lib/utils";

/** Everyone's card counts + whose turn — so the game needs no shared TV. */
function PlayersStrip({ view }: { view: PrivateCheatView }) {
  const youId = view.you.playerId;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-2">
      {view.table.players.map((p) => (
        <div
          key={p.playerId}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
            p.isCurrent ? "border-gold/50 bg-gold/10" : "border-white/10 bg-white/[0.03]",
            p.handCount === 0 && "border-lime/50 bg-lime/10",
            !p.isActive && "opacity-60",
          )}
        >
          <Avatar color={p.avatar.color} emoji={p.avatar.emoji} size="xs" active={p.isActive} />
          <span className="max-w-16 truncate font-semibold">
            {p.playerId === youId ? "You" : p.displayName}
          </span>
          <span className="font-bold tabular-nums">{p.handCount === 0 ? "🎉" : p.handCount}</span>
        </div>
      ))}
    </div>
  );
}

/** Cheat controller — grouped hand, bluff-friendly multi-select, play & challenge. */
export function CheatControllerView({ view, onMove, submitting }: GameControllerProps) {
  const v = view as PrivateCheatView;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const move = (m: CheatMove) => {
    setSelected(new Set());
    void onMove(m);
  };

  const nameOf = (id: string) =>
    v.table.players.find((p) => p.playerId === id)?.displayName ?? "Player";

  // Group the hand by rank (already sorted rank→suit on the server).
  const hand = v.you.hand;
  const groups = useMemo(() => {
    const byRank = new Map<Rank, typeof hand>();
    for (const c of hand) {
      const arr = byRank.get(c.rank) ?? [];
      arr.push(c);
      byRank.set(c.rank, arr);
    }
    return [...byRank.entries()].sort((a, b) => a[0] - b[0]);
  }, [hand]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < v.actions.maxClaim) next.add(id);
      return next;
    });
  };

  const count = selected.size;
  const current = v.table.players.find((p) => p.playerId === v.table.currentPlayerId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Status */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 text-sm">
        <span className="chip">Pile {v.table.pileSize}</span>
        <span className="chip">
          Required: <span className="font-bold text-cream">{v.requiredRankLabel}</span>
        </span>
        <span className="chip">{v.you.hand.length} in hand</span>
      </div>

      <PlayersStrip view={v} />

      {/* Last claim + Call Cheat */}
      {v.lastClaim ? (
        <div className="px-3 pt-2">
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-2xl border px-3 py-2",
              v.actions.canChallenge ? "border-coral/40 bg-coral/10" : "border-white/10 bg-white/[0.03]",
            )}
          >
            <div className="min-w-0 text-sm">
              <span className="font-semibold">{nameOf(v.lastClaim.playerId)}</span>{" "}
              <span className="text-haze">claimed</span>{" "}
              <span className="font-semibold">
                {v.lastClaim.count} {v.lastClaim.claimedRankLabel}
              </span>
            </div>
            {v.actions.canChallenge ? (
              <Button
                size="sm"
                variant="danger"
                disabled={submitting}
                onClick={() => move({ type: "challenge" })}
              >
                <Flame className="size-4" /> Cheat!
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Turn banner */}
      <div className="px-3 pt-2 text-center">
        {v.isYourTurn ? (
          <div className="font-display text-lg font-bold text-lime">
            Your turn — claim {v.requiredRankLabel}
            <span className="block text-xs font-normal text-haze">
              Play matching cards… or bluff. They&apos;re face-down. 🤫
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-haze">
            {current ? (
              <Avatar color={current.avatar.color} emoji={current.avatar.emoji} size="xs" />
            ) : null}
            <span className="text-sm">{current?.displayName ?? "Someone"} is playing…</span>
          </div>
        )}
      </div>

      {/* Hand grouped by rank */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {groups.length === 0 ? (
          <div className="flex h-full items-center justify-center text-haze">
            Hand empty — waiting to win! 🎉
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map(([rank, cards]) => (
              <div key={rank}>
                <div className="mb-1 text-[0.65rem] uppercase tracking-[0.2em] text-haze">
                  {rankPlural(rank)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cards.map((card) => (
                    <StandardCardFace
                      key={card.id}
                      card={card}
                      size="md"
                      selected={selected.has(card.id)}
                      disabled={!v.isYourTurn}
                      onClick={v.isYourTurn ? () => toggle(card.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Play action */}
      {v.isYourTurn ? (
        <div className="border-t border-white/10 bg-ink-2/90 p-3 backdrop-blur">
          <Button
            size="lg"
            variant="primary"
            className="w-full font-display"
            disabled={count < 1 || count > v.actions.maxClaim || submitting}
            onClick={() => move({ type: "play", cardIds: [...selected] })}
          >
            {count < 1
              ? `Select up to ${v.actions.maxClaim} cards`
              : `Play ${count} face-down as ${v.requiredRankLabel}`}
          </Button>
          {count > 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 text-center text-xs text-haze"
            >
              They don&apos;t have to actually be {v.requiredRankLabel} 😏
            </motion.p>
          ) : null}
        </div>
      ) : null}

      <CheatRevealOverlay challenge={v.lastChallenge} nameOf={nameOf} compact />
    </div>
  );
}
