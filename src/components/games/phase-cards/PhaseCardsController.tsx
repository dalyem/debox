"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers } from "lucide-react";
import { type Card, isFreeze } from "@/lib/cards";
import { canHitLaidGroup } from "@/lib/games/phase-cards/melds";
import type { PhaseDefinition } from "@/lib/games/phase-cards/phases";
import type {
  LaidGroup,
  PhaseCardsMove,
  PrivateGameView,
} from "@/lib/games/phase-cards/types";
import { DragCard, DragDropProvider, useDropZone } from "./dnd";
import { GamePiles } from "./GamePiles";
import { MeldRow } from "./MeldRow";
import { ObjectiveStrip } from "./ObjectiveStrip";
import { LayDownBuilder } from "./LayDownBuilder";
import { Leaderboard } from "./Leaderboard";
import { Avatar } from "@/components/platform/Avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function DroppableMeld({
  group,
  canDrop,
  onDrop,
}: {
  group: LaidGroup;
  canDrop: boolean;
  onDrop: (card: Card) => void;
}) {
  const { dropProps, active } = useDropZone(
    (card) => canDrop && canHitLaidGroup(group, card).ok,
    onDrop,
  );
  return (
    <div
      {...dropProps}
      className={cn(
        "rounded-lg p-0.5 transition",
        active && "scale-105 bg-lime/20 ring-2 ring-lime",
      )}
    >
      <MeldRow group={group} size="sm" />
    </div>
  );
}

export function PhaseCardsController({
  view,
  onMove,
  submitting,
  storageKey,
}: {
  view: PrivateGameView;
  onMove: (move: PhaseCardsMove) => Promise<void>;
  submitting: boolean;
  storageKey?: string;
}) {
  const you = view.you;
  const [mode, setMode] = useState<"play" | "laydown">("play");
  const [tab, setTab] = useState<"play" | "scores">("play");
  const [pendingFreeze, setPendingFreeze] = useState<Card | null>(null);

  // Persisted hand order (kept across the round; new draws go to the top/end).
  const [order, setOrder] = useState<string[]>(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw) as string[];
      } catch {
        /* ignore */
      }
    }
    return you.hand.map((c) => c.id);
  });

  useEffect(() => {
    setOrder((prev) => {
      const ids = new Set(you.hand.map((c) => c.id));
      const kept = prev.filter((id) => ids.has(id));
      const keptSet = new Set(kept);
      const added = you.hand.map((c) => c.id).filter((id) => !keptSet.has(id));
      return [...kept, ...added];
    });
  }, [you.hand]);

  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(order));
      } catch {
        /* ignore */
      }
    }
  }, [order, storageKey]);

  const handById = useMemo(
    () => new Map(you.hand.map((c) => [c.id, c])),
    [you.hand],
  );
  const orderedCards = order
    .map((id) => handById.get(id))
    .filter((c): c is Card => !!c);

  const reorder = (cardId: string, overCardId: string) =>
    setOrder((prev) => {
      const from = prev.indexOf(cardId);
      const to = prev.indexOf(overCardId);
      if (from === -1 || to === -1) return prev;
      const next = prev.slice();
      next.splice(from, 1);
      next.splice(to, 0, cardId);
      return next;
    });

  const phase: PhaseDefinition = {
    index: you.phaseIndex,
    name: you.phaseName,
    blurb: you.phaseBlurb,
    requirements: you.requirements,
  };

  const freezeTargets = view.table.filter(
    (t) =>
      t.playerId !== you.playerId &&
      !t.finishedLadder &&
      !view.frozenThisRound.includes(t.playerId),
  );

  const move = async (m: PhaseCardsMove) => {
    setPendingFreeze(null);
    setMode("play");
    await onMove(m);
  };

  const discardCard = (card: Card) => {
    if (isFreeze(card) && freezeTargets.length > 0) {
      setPendingFreeze(card);
      return;
    }
    void move({ type: "discard", cardId: card.id });
  };

  const a = view.actions;
  const hint = !view.isYourTurn
    ? null
    : !view.hasDrawn
      ? "Your turn — tap a pile to draw"
      : "Drag a card to the discard to end your turn";

  return (
    <DragDropProvider onReorder={reorder}>
      {mode === "laydown" ? (
        <div className="flex flex-col gap-4 px-3 pb-6 pt-3">
          <LayDownBuilder
            phase={phase}
            hand={orderedCards}
            submitting={submitting}
            onCancel={() => setMode("play")}
            onSubmit={(groups) => move({ type: "layDown", groups })}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Play / Scores tabs */}
          <div className="flex gap-1 px-3 pt-3">
            {(["play", "scores"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  tab === t ? "bg-white/15 text-cream" : "text-haze hover:bg-white/5",
                )}
              >
                {t === "play" ? "Play" : "Scores"}
              </button>
            ))}
          </div>

          {tab === "scores" ? (
            <div className="flex-1 overflow-y-auto p-3">
              <Leaderboard players={view.table} youId={you.playerId} />
            </div>
          ) : (
            <>
              {/* Table (scrolls) */}
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3">
                {/* Your objective */}
                <div className="surface mb-3 flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="text-[0.65rem] uppercase tracking-[0.25em] text-haze">
                      {you.finishedLadder ? "Status" : `Your Phase ${you.phaseIndex}`}
                    </div>
                    <div className="font-display text-lg font-bold">
                      {you.phaseName}
                    </div>
                    {!you.completedPhase ? (
                      <ObjectiveStrip
                        requirements={you.requirements}
                        size="sm"
                        className="mt-1.5"
                      />
                    ) : null}
                  </div>
                  {a.canLayDown ? (
                    <Button size="sm" variant="lime" onClick={() => setMode("laydown")}>
                      <Layers className="size-4" /> Build
                    </Button>
                  ) : you.completedPhase ? (
                    <span className="chip border-lime/40 bg-lime/15 text-lime">
                      Down ✓
                    </span>
                  ) : null}
                </div>

                {/* Everyone's melds (drop a card on a meld to add to it) */}
                <div className="flex flex-col gap-2 pb-2">
                  {view.table.map((p) => {
                    const isCurrent = p.playerId === view.currentPlayerId;
                    return (
                      <div
                        key={p.playerId}
                        className={cn(
                          "rounded-2xl border p-2.5",
                          isCurrent
                            ? "border-gold/50 bg-gold/10"
                            : "border-white/10 bg-white/[0.03]",
                          !p.isActive && "opacity-60",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar
                            color={p.avatar.color}
                            emoji={p.avatar.emoji}
                            size="xs"
                            active={p.isActive}
                          />
                          <span className="truncate text-sm font-semibold">
                            {p.displayName}
                            {p.playerId === you.playerId ? (
                              <span className="ml-1 text-xs text-grape-bright">
                                (you)
                              </span>
                            ) : null}
                          </span>
                          {isCurrent ? (
                            <span className="rounded-full bg-gold px-1.5 text-[0.6rem] font-bold text-[#3a2400]">
                              NOW
                            </span>
                          ) : null}
                          <span className="ml-auto text-xs text-haze">
                            P{p.phaseIndex} · {p.handCount}🂠
                          </span>
                        </div>
                        {p.laidGroups.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                            {p.laidGroups.map((g, gi) => (
                              <DroppableMeld
                                key={gi}
                                group={g}
                                canDrop={!!a.canHit}
                                onDrop={(card) =>
                                  move({
                                    type: "hit",
                                    targetPlayerId: p.playerId,
                                    groupIndex: gi,
                                    cardId: card.id,
                                  })
                                }
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-haze/70">
                            nothing down yet
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Piles (tap to draw / drop to discard) */}
              <div className="border-t border-white/10 bg-ink-2/70 px-3 pt-2 backdrop-blur">
                {hint ? (
                  <p className="text-center text-[0.7rem] font-semibold text-haze">
                    {hint}
                  </p>
                ) : (
                  <p className="flex items-center justify-center gap-2 text-center text-[0.7rem] text-haze">
                    <Avatar
                      color={
                        view.table.find((t) => t.playerId === view.currentPlayerId)
                          ?.avatar.color ?? "slate"
                      }
                      emoji={
                        view.table.find((t) => t.playerId === view.currentPlayerId)
                          ?.avatar.emoji ?? "🙂"
                      }
                      size="xs"
                    />
                    Waiting for{" "}
                    {view.table.find((t) => t.playerId === view.currentPlayerId)
                      ?.displayName ?? "…"}
                  </p>
                )}
                <GamePiles
                  drawCount={view.drawCount}
                  discardTop={view.discardTop}
                  canDrawDeck={a.canDraw}
                  canTakeDiscard={a.canDrawFromDiscard}
                  canDiscard={view.isYourTurn && view.hasDrawn}
                  onDrawDeck={() => move({ type: "draw", source: "draw" })}
                  onTakeDiscard={() => move({ type: "draw", source: "discard" })}
                  onDiscardCard={discardCard}
                />
              </div>

              {/* Fanned, draggable hand */}
              <div className="bg-ink-2/90 px-2 pb-2 pt-1 backdrop-blur">
                <div className="flex items-end justify-center">
                  {orderedCards.map((card, i) => (
                    <div key={card.id} className={cn(i > 0 && "-ml-9")} style={{ zIndex: i }}>
                      <DragCard card={card} size="md" />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-center text-[0.65rem] text-haze/70">
                  drag to discard / meld · drag sideways to reorder
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Freeze target picker */}
      <AnimatePresence>
        {pendingFreeze ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPendingFreeze(null)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="surface-pop w-full max-w-md rounded-b-none p-5"
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
              <h3 className="mb-1 font-display text-lg font-bold">Freeze someone ❄️</h3>
              <p className="mb-3 text-sm text-haze">Pick a player to skip their next turn.</p>
              <div className="grid grid-cols-2 gap-2">
                {freezeTargets.map((t) => (
                  <button
                    key={t.playerId}
                    type="button"
                    onClick={() =>
                      move({
                        type: "discard",
                        cardId: pendingFreeze.id,
                        skipTargetPlayerId: t.playerId,
                      })
                    }
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.07]"
                  >
                    <Avatar color={t.avatar.color} emoji={t.avatar.emoji} size="md" />
                    <span className="truncate text-sm font-semibold">
                      {t.displayName}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </DragDropProvider>
  );
}
