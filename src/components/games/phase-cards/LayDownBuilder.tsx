"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { Card } from "@/lib/cards";
import { validateGroup } from "@/lib/cards/validate";
import { type PhaseDefinition, validatePhase } from "@/lib/games/phase-cards/phases";
import { PlayingCard } from "./PlayingCard";
import { Hand } from "./Hand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Build a phase by tapping cards into objective slots. Validates live (client-
 * side preview) — the server re-validates authoritatively on submit.
 */
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

  const assignedIds = useMemo(
    () => new Set(assignments.flat()),
    [assignments],
  );

  const groups = assignments.map((ids) =>
    ids.map((id) => handMap.get(id)!).filter(Boolean),
  );
  const phaseCheck = validatePhase(phase, groups);

  const addToActive = (id: string) => {
    if (assignedIds.has(id)) return;
    setAssignments((prev) =>
      prev.map((ids, i) => (i === activeSlot ? [...ids, id] : ids)),
    );
  };
  const removeFromSlot = (slot: number, id: string) => {
    setAssignments((prev) =>
      prev.map((ids, i) => (i === slot ? ids.filter((x) => x !== id) : ids)),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.25em] text-haze">
          Build Phase {phase.index}
        </div>
        <div className="font-display text-xl font-bold">{phase.name}</div>
      </div>

      {/* Objective slots */}
      <div className="flex flex-col gap-2">
        {phase.requirements.map((req, i) => {
          const slotCards = groups[i] ?? [];
          const ok = validateGroup(req.type, slotCards, req.count).ok;
          const isActive = i === activeSlot;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActiveSlot(i)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
                isActive
                  ? "border-grape-bright/70 bg-grape/15"
                  : "border-white/10 bg-white/[0.03]",
              )}
            >
              <div className="min-w-[5.5rem]">
                <div className="font-display text-sm font-bold">{req.label}</div>
                <div
                  className={cn(
                    "text-xs",
                    ok ? "text-lime" : "text-haze",
                  )}
                >
                  {slotCards.length}/{req.count}
                  {ok ? " ✓" : ""}
                </div>
              </div>
              <div className="flex min-h-[3.5rem] flex-1 flex-wrap items-center gap-1">
                {slotCards.map((c) => (
                  <PlayingCard
                    key={c.id}
                    card={c}
                    size="sm"
                    onClick={() => removeFromSlot(i, c.id)}
                  />
                ))}
                {slotCards.length === 0 ? (
                  <span className="text-xs text-haze/70">
                    {isActive ? "Tap cards below →" : "Tap to fill"}
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
            </button>
          );
        })}
      </div>

      {/* Hand */}
      <div className="rounded-2xl bg-black/20 p-3">
        <Hand
          cards={hand}
          dimmedIds={assignedIds}
          onTap={addToActive}
          size="md"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <X className="size-4" /> Cancel
        </Button>
        <motion.div className="flex-[2]" animate={{ scale: phaseCheck.ok ? [1, 1.03, 1] : 1 }}>
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
