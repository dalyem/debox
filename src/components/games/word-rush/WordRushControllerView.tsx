"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Delete, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameControllerProps } from "@/components/games/registry";
import type { PrivateWordRushView, TileState } from "@/lib/games/word-rush/types";
import { Board, CountdownPill } from "./WordRushBoard";

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

/**
 * Keyboard hint colours — high-contrast so the state of every letter reads at a
 * glance: vivid green for a correct spot, yellow for in-the-word, and a clearly
 * dimmed dark grey for letters that have been tried and eliminated. Unused keys
 * stay bright to look tappable.
 */
const KEY_COLOR: Record<TileState, string> = {
  correct: "bg-[#6aaa64] text-white",
  present: "bg-[#c9b458] text-white",
  absent: "bg-[#3a3a3c] text-white/40",
};
const KEY_DEFAULT = "bg-white/20 text-cream hover:bg-white/30";

function Key({
  label,
  state,
  wide,
  onClick,
  disabled,
  children,
}: {
  label: string;
  state?: TileState;
  wide?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-12 select-none items-center justify-center rounded-md font-display text-lg font-bold uppercase transition-all active:translate-y-px disabled:opacity-40",
        wide ? "px-3" : "flex-1",
        state ? KEY_COLOR[state] : KEY_DEFAULT,
      )}
    >
      {children ?? label}
    </button>
  );
}

export function WordRushControllerView({ view: raw, onMove, submitting }: GameControllerProps) {
  const view = raw as PrivateWordRushView;
  const { wordLength, maxGuesses } = view;
  const [draft, setDraft] = useState("");

  const rowsLen = view.you.rows.length;
  // New row landed (or a fresh round started) → clear the in-progress guess.
  useEffect(() => {
    setDraft("");
  }, [rowsLen, view.round]);

  const canType = view.canGuess && !submitting;

  const addLetter = useCallback(
    (ch: string) => {
      if (!canType) return;
      setDraft((d) => (d.length < wordLength ? d + ch : d));
    },
    [canType, wordLength],
  );
  const backspace = useCallback(() => {
    if (!canType) return;
    setDraft((d) => d.slice(0, -1));
  }, [canType]);
  const submit = useCallback(() => {
    if (!canType || draft.length !== wordLength) return;
    void onMove({ type: "guess", word: draft });
  }, [canType, draft, wordLength, onMove]);

  // Physical keyboard (desktop / connected keyboards).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        addLetter(e.key.toUpperCase());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addLetter, backspace, submit]);

  const roundOver = view.phase === "round_over" || view.phase === "game_over";
  const you = view.you;

  const statusBanner = (() => {
    if (roundOver) return null;
    if (you.status === "solved")
      return { text: `Solved in ${you.guessesUsed}! +${you.roundScore} pts`, tone: "good" as const };
    if (you.status === "failed")
      return { text: `Out of guesses · ${you.roundScore} pts`, tone: "bad" as const };
    if (you.status === "timed_out")
      return { text: "Out of time — no points", tone: "bad" as const };
    return null;
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Round + score strip */}
      <div className="flex items-center justify-between gap-2 px-4 py-1.5 text-sm">
        <span className="chip">
          Round {view.round}/{view.maxRounds}
        </span>
        <CountdownPill deadline={view.countdownDeadline} />
        <span className="chip">
          <span className="text-gold">{you.totalScore}</span>&nbsp;pts · first to {view.targetScore}
        </span>
      </div>

      {/* Board */}
      <div className="flex flex-1 min-h-0 items-center justify-center overflow-hidden px-4">
        <Board
          rows={you.rows.map((r) => ({ letters: r.word.split(""), pattern: r.pattern }))}
          current={you.status === "playing" && !roundOver ? draft : undefined}
          wordLength={wordLength}
          maxGuesses={maxGuesses}
          size="lg"
        />
      </div>

      {/* Status / reveal / keyboard */}
      <div className="px-3 pb-3 pt-1">
        {roundOver ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface flex flex-col items-center gap-1 p-4 text-center"
          >
            <div className="text-xs uppercase tracking-[0.25em] text-haze">The word was</div>
            <div className="font-display text-3xl font-bold tracking-[0.2em] text-neon">
              {view.reveal}
            </div>
            <div className="mt-1 text-sm text-haze">
              {you.status === "solved"
                ? `You got it in ${you.guessesUsed} · +${you.roundScore} pts`
                : you.status === "failed"
                  ? `Missed it · ${you.roundScore} pts`
                  : "Ran out of time"}
              {" · "}
              {you.totalScore} total
            </div>
            <div className="mt-1 text-xs text-haze">Next word coming up…</div>
          </motion.div>
        ) : statusBanner ? (
          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center",
              statusBanner.tone === "good"
                ? "border-lime/40 bg-lime/10"
                : "border-coral/40 bg-coral/10",
            )}
          >
            <div className="font-display text-lg font-bold">{statusBanner.text}</div>
            <CountdownPill deadline={view.countdownDeadline} />
            <p className="text-xs text-haze">
              {view.countdownDeadline
                ? "Hang tight — others are still racing."
                : "Waiting for the round to wrap up…"}
            </p>
          </div>
        ) : (
          // pb clears the bottom-left reaction FAB so it can't cover Enter.
          <div className="flex flex-col gap-1.5 pb-14">
            {KEY_ROWS.map((row, i) => (
              <div key={i} className="flex justify-center gap-1.5">
                {i === 2 ? (
                  <Key label="Enter" wide onClick={submit} disabled={!canType || draft.length !== wordLength}>
                    <CornerDownLeft className="size-4" />
                  </Key>
                ) : null}
                {row.split("").map((ch) => (
                  <Key
                    key={ch}
                    label={ch}
                    state={you.keyboard[ch]}
                    onClick={() => addLetter(ch)}
                    disabled={!canType}
                  />
                ))}
                {i === 2 ? (
                  <Key label="Backspace" wide onClick={backspace} disabled={!canType}>
                    <Delete className="size-4" />
                  </Key>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
