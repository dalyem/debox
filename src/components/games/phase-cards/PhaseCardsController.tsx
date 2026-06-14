"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hand as HandIcon, Layers, Plus, Trash2 } from "lucide-react";
import { type Card, isFreeze } from "@/lib/cards";
import { canHit } from "@/lib/cards/validate";
import type { PhaseDefinition } from "@/lib/games/phase-cards/phases";
import type {
  PhaseCardsMove,
  PrivateGameView,
} from "@/lib/games/phase-cards/types";
import { PlayingCard } from "./PlayingCard";
import { Hand } from "./Hand";
import { MeldRow } from "./MeldRow";
import { ObjectiveStrip } from "./ObjectiveStrip";
import { LayDownBuilder } from "./LayDownBuilder";
import { Avatar } from "@/components/platform/Avatar";
import { Button } from "@/components/ui/button";

interface HitOption {
  targetPlayerId: string;
  targetName: string;
  groupIndex: number;
  label: string;
  cards: Card[];
}

export function PhaseCardsController({
  view,
  onMove,
  submitting,
}: {
  view: PrivateGameView;
  onMove: (move: PhaseCardsMove) => Promise<void>;
  submitting: boolean;
}) {
  const you = view.you;
  const [mode, setMode] = useState<"play" | "laydown">("play");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hitOpen, setHitOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);

  const phase: PhaseDefinition = {
    index: you.phaseIndex,
    name: you.phaseName,
    blurb: you.phaseBlurb,
    requirements: you.requirements,
  };

  const selectedCard = useMemo(
    () => you.hand.find((c) => c.id === selectedId) ?? null,
    [you.hand, selectedId],
  );

  const hitOptions = useMemo<HitOption[]>(() => {
    if (!selectedCard || !view.actions.canHit) return [];
    const opts: HitOption[] = [];
    for (const p of view.table) {
      p.laidGroups.forEach((g, gi) => {
        if (canHit(g.type, g.cards, selectedCard).ok) {
          opts.push({
            targetPlayerId: p.playerId,
            targetName: p.displayName,
            groupIndex: gi,
            label: g.label,
            cards: g.cards,
          });
        }
      });
    }
    return opts;
  }, [selectedCard, view.actions.canHit, view.table]);

  const freezeTargets = view.table.filter(
    (t) => t.playerId !== you.playerId && !t.finishedLadder,
  );

  const reset = () => {
    setSelectedId(null);
    setMode("play");
    setHitOpen(false);
    setFreezeOpen(false);
  };

  const move = async (m: PhaseCardsMove) => {
    await onMove(m);
    reset();
  };

  const onDiscard = () => {
    if (!selectedCard) return;
    if (isFreeze(selectedCard) && freezeTargets.length > 0) {
      setFreezeOpen(true);
      return;
    }
    void move({ type: "discard", cardId: selectedCard.id });
  };

  /* ---- LAY DOWN MODE ---- */
  if (mode === "laydown") {
    return (
      <div className="flex flex-col gap-4 px-3 pb-28 pt-3">
        <LayDownBuilder
          phase={phase}
          hand={you.hand}
          submitting={submitting}
          onCancel={() => setMode("play")}
          onSubmit={(groups) => move({ type: "layDown", groups })}
        />
      </div>
    );
  }

  /* ---- PLAY MODE ---- */
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Objective */}
      <div className="px-3 pt-3">
        <div className="surface flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.25em] text-haze">
                {you.finishedLadder ? "Status" : `Your Phase ${you.phaseIndex}`}
              </div>
              <div className="font-display text-lg font-bold">{you.phaseName}</div>
            </div>
            {you.completedPhase ? (
              <span className="chip border-lime/40 bg-lime/15 text-lime">Laid down ✓</span>
            ) : (
              <span className="chip text-haze">{you.score} pts</span>
            )}
          </div>
          {!you.completedPhase ? (
            <ObjectiveStrip requirements={you.requirements} size="sm" />
          ) : you.laidGroups.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {you.laidGroups.map((g, i) => (
                <MeldRow key={i} group={g} size="xs" />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Hand */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <Hand
          cards={you.hand}
          selectedIds={selectedId ? new Set([selectedId]) : undefined}
          onTap={
            view.isYourTurn && view.hasDrawn
              ? (id) => setSelectedId((cur) => (cur === id ? null : id))
              : undefined
          }
          disabled={!view.isYourTurn || !view.hasDrawn}
          size="md"
        />
      </div>

      {/* Action dock */}
      <div className="sticky bottom-0 z-10 border-t border-white/10 bg-ink-2/90 px-3 py-3 backdrop-blur">
        {!view.isYourTurn ? (
          <WaitingDock view={view} />
        ) : !view.hasDrawn ? (
          <DrawDock view={view} onMove={move} disabled={submitting} />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-center text-xs text-haze">
              {selectedCard
                ? `Selected ${selectedCard.kind === "number" ? `${selectedCard.value}` : selectedCard.kind}`
                : "Tap a card, then discard to end your turn."}
            </p>
            <div className="flex gap-2">
              {view.actions.canLayDown ? (
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setMode("laydown")}
                >
                  <Layers className="size-4" /> Build phase
                </Button>
              ) : null}
              {view.actions.canHit ? (
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={hitOptions.length === 0}
                  onClick={() => setHitOpen(true)}
                >
                  <Plus className="size-4" /> Add to meld
                </Button>
              ) : null}
              <Button
                variant="primary"
                className="flex-1"
                disabled={!selectedCard || submitting}
                onClick={onDiscard}
              >
                <Trash2 className="size-4" /> Discard
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hit sheet */}
      <AnimatePresence>
        {hitOpen ? (
          <BottomSheet title="Add to a meld" onClose={() => setHitOpen(false)}>
            {selectedCard ? (
              <div className="mb-3 flex items-center justify-center">
                <PlayingCard card={selectedCard} size="md" />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              {hitOptions.map((o) => (
                <button
                  key={`${o.targetPlayerId}-${o.groupIndex}`}
                  type="button"
                  onClick={() =>
                    move({
                      type: "hit",
                      targetPlayerId: o.targetPlayerId,
                      groupIndex: o.groupIndex,
                      cardId: selectedCard!.id,
                    })
                  }
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.07]"
                >
                  <div className="min-w-[5rem] text-sm">
                    <div className="font-semibold">{o.targetName}</div>
                    <div className="text-xs text-haze">{o.label}</div>
                  </div>
                  <MeldRow group={{ type: "set", count: o.cards.length, label: o.label, cards: o.cards }} size="xs" />
                </button>
              ))}
            </div>
          </BottomSheet>
        ) : null}
      </AnimatePresence>

      {/* Freeze target picker */}
      <AnimatePresence>
        {freezeOpen ? (
          <BottomSheet title="Freeze someone ❄️" onClose={() => setFreezeOpen(false)}>
            <p className="mb-3 text-center text-sm text-haze">
              Pick a player to skip their next turn.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {freezeTargets.map((t) => (
                <button
                  key={t.playerId}
                  type="button"
                  onClick={() =>
                    move({
                      type: "discard",
                      cardId: selectedCard!.id,
                      skipTargetPlayerId: t.playerId,
                    })
                  }
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.07]"
                >
                  <Avatar color={t.avatar.color} emoji={t.avatar.emoji} size="md" />
                  <span className="truncate text-sm font-semibold">{t.displayName}</span>
                </button>
              ))}
            </div>
          </BottomSheet>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function WaitingDock({ view }: { view: PrivateGameView }) {
  const current = view.table.find((t) => t.playerId === view.currentPlayerId);
  return (
    <div className="flex items-center justify-center gap-3 py-1">
      {current ? (
        <>
          <Avatar color={current.avatar.color} emoji={current.avatar.emoji} size="sm" />
          <span className="text-haze">
            Waiting for <span className="font-semibold text-cream">{current.displayName}</span>…
          </span>
        </>
      ) : (
        <span className="text-haze">Waiting…</span>
      )}
    </div>
  );
}

function DrawDock({
  view,
  onMove,
  disabled,
}: {
  view: PrivateGameView;
  onMove: (m: PhaseCardsMove) => Promise<void>;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-xs font-semibold text-lime">
        Your turn — draw a card to start.
      </p>
      <div className="flex items-stretch gap-2">
        <Button
          variant="primary"
          className="h-16 flex-1 flex-col gap-0"
          disabled={disabled || !view.actions.canDraw}
          onClick={() => onMove({ type: "draw", source: "draw" })}
        >
          <HandIcon className="size-5" />
          <span>Draw deck</span>
          <span className="text-[0.65rem] opacity-80">{view.drawCount} left</span>
        </Button>
        <Button
          variant="accent"
          className="h-16 flex-1 flex-col gap-1"
          disabled={disabled || !view.actions.canDrawFromDiscard}
          onClick={() => onMove({ type: "draw", source: "discard" })}
        >
          {view.discardTop ? (
            <span className="flex items-center gap-2">
              <PlayingCard card={view.discardTop} size="xs" />
              Take discard
            </span>
          ) : (
            <span>Discard empty</span>
          )}
        </Button>
      </div>
    </div>
  );
}

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="surface-pop max-h-[75vh] w-full max-w-md overflow-y-auto rounded-b-none p-5"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-sm text-haze">
            Close
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
