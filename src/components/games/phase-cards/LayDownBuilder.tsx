"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { Card } from "@/lib/cards";
import { validateGroup } from "@/lib/cards/validate";
import {
  type PhaseDefinition,
  type PhaseRequirement,
  validatePhase,
} from "@/lib/games/phase-cards/phases";
import { PlayingCard } from "./PlayingCard";
import { DragCard, useDropZone } from "./dnd";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Build a phase by dragging (or tapping) cards into objective slots. Validates
 * live; the server re-validates authoritatively on submit.
 */
function Slot({
  req,
  cards,
  ok,
  isActive,
  onActivate,
  onDropCard,
  onRemove,
}: {
  req: PhaseRequirement;
  cards: Card[];
  ok: boolean;
  isActive: boolean;
  onActivate: () => void;
  onDropCard: (cardId: string) => void;
  onRemove: (cardId: string) => void;
}) {
  const { dropProps, active } = useDropZone(
    () => true,
    (card) => onDropCard(card.id),
  );
  return (
    <div
      {...dropProps}
      onClick={onActivate}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition",
        active
          ? "border-lime bg-lime/10 ring-2 ring-lime"
          : isActive
            ? "border-grape-bright/70 bg-grape/15"
            : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="min-w-[5.5rem]">
        <div className="font-display text-sm font-bold">{req.label}</div>
        <div className={cn("text-xs", ok ? "text-lime" : "text-haze")}>
          {cards.length}/{req.count}
          {ok ? " ✓" : ""}
        </div>
      </div>
      <div className="flex min-h-[3.5rem] flex-1 flex-wrap items-center gap-1">
        {cards.map((c) => (
          <span
            key={c.id}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(c.id);
            }}
          >
            <PlayingCard card={c} size="sm" />
          </span>
        ))}
        {cards.length === 0 ? (
          <span className="text-xs text-haze/70">
            {isActive ? "drag cards here ↓" : "drag or tap to fill"}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          ok ? "bg-lime/20 text-lime" : "bg-white/5 text-haze",
        )}
      >
        {ok ? <Check className="size-4" /> : <span className="text-xs">{req.count}</span>}
      </div>
    </div>
  );
}

export function LayDownBuilder({
  phase,
  hand,
  onSubmit,
  onCancel,
  submitting,
}: {
  phase: PhaseDefinition;
  hand: Card[];
  onSubmit: (groups: string[][]) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const handMap = useMemo(() => new Map(hand.map((c) => [c.id, c])), [hand]);
  const [assignments, setAssignments] = useState<string[][]>(
    phase.requirements.map(() => []),
  );
  const [activeSlot, setActiveSlot] = useState(0);

  const assignedIds = useMemo(() => new Set(assignments.flat()), [assignments]);
  const groups = assignments.map((ids) =>
    ids.map((id) => handMap.get(id)!).filter(Boolean),
  );
  const phaseCheck = validatePhase(phase, groups);

  const assignToSlot = (id: string, slot: number) =>
    setAssignments((prev) =>
      prev.map((ids, i) =>
        i === slot ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id),
      ),
    );
  const tapAdd = (id: string) => {
    if (assignedIds.has(id)) return;
    assignToSlot(id, activeSlot);
  };
  const removeFromSlot = (slot: number, id: string) =>
    setAssignments((prev) =>
      prev.map((ids, i) => (i === slot ? ids.filter((x) => x !== id) : ids)),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.25em] text-haze">
          Build Phase {phase.index}
        </div>
        <div className="font-display text-xl font-bold">{phase.name}</div>
      </div>

      <div className="flex flex-col gap-2">
        {phase.requirements.map((req, i) => (
          <Slot
            key={i}
            req={req}
            cards={groups[i] ?? []}
            ok={validateGroup(req.type, groups[i] ?? [], req.count).ok}
            isActive={i === activeSlot}
            onActivate={() => setActiveSlot(i)}
            onDropCard={(id) => assignToSlot(id, i)}
            onRemove={(id) => removeFromSlot(i, id)}
          />
        ))}
      </div>

      {/* Hand — drag a card into a slot, or tap to drop it in the active slot */}
      <div className="rounded-2xl bg-black/20 p-3">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {hand.map((card) => (
            <div key={card.id} onClick={() => tapAdd(card.id)}>
              <DragCard card={card} size="md" dimmed={assignedIds.has(card.id)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <X className="size-4" /> Cancel
        </Button>
        <motion.div
          className="flex-[2]"
          animate={{ scale: phaseCheck.ok ? [1, 1.03, 1] : 1 }}
        >
          <Button
            variant="lime"
            className="w-full font-display text-lg"
            disabled={!phaseCheck.ok || submitting}
            onClick={() => onSubmit(assignments)}
          >
            {submitting ? "Laying down…" : "Lay it down!"}
          </Button>
        </motion.div>
      </div>
      {!phaseCheck.ok && assignedIds.size > 0 ? (
        <p className="text-center text-xs text-coral">{phaseCheck.reason}</p>
      ) : null}
    </div>
  );
}
