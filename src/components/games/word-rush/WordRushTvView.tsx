"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/platform/Avatar";
import { cn } from "@/lib/utils";
import type { GameTvProps } from "@/components/games/registry";
import type { PublicBoard, PublicWordRushView } from "@/lib/games/word-rush/types";
import { Board, CountdownPill } from "./WordRushBoard";

function StatusBadge({ board, maxGuesses }: { board: PublicBoard; maxGuesses: number }) {
  if (board.status === "solved") {
    return (
      <span className="chip border-lime/40 bg-lime/15 text-lime">
        🟩 #{board.placement} · +{board.roundScore}
      </span>
    );
  }
  if (board.status === "failed") {
    return <span className="chip border-coral/40 bg-coral/15 text-coral">💀 missed</span>;
  }
  if (board.status === "timed_out") {
    return <span className="chip border-white/15 text-haze">⏰ out of time</span>;
  }
  return (
    <span className="chip">
      <motion.span
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="text-lime"
      >
        ●
      </motion.span>
      {board.guessesUsed}/{maxGuesses}
    </span>
  );
}

function PlayerCard({
  board,
  view,
  isLeader,
}: {
  board: PublicBoard;
  view: PublicWordRushView;
  isLeader: boolean;
}) {
  return (
    <motion.div
      layout
      className={cn(
        "surface flex flex-col items-center gap-3 p-4",
        board.status === "solved" && "ring-2 ring-lime/40",
        !board.isActive && "opacity-60",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <Avatar color={board.avatar.color} emoji={board.avatar.emoji} size="sm" active={board.isActive} />
        <span className="min-w-0 flex-1 truncate font-display font-bold">{board.displayName}</span>
        {isLeader && board.totalScore > 0 ? <Crown className="size-4 text-gold" /> : null}
        <span className="font-display text-xl font-bold tabular-nums text-gold">
          {board.totalScore}
        </span>
      </div>

      <Board
        rows={board.rows.map((pattern) => ({ pattern }))}
        wordLength={view.wordLength}
        maxGuesses={view.maxGuesses}
        size="sm"
      />

      <StatusBadge board={board} maxGuesses={view.maxGuesses} />
    </motion.div>
  );
}

export function WordRushTvView({ view: raw }: GameTvProps) {
  const view = raw as PublicWordRushView;
  const reveal = view.reveal;
  const topScore = Math.max(0, ...view.boards.map((b) => b.totalScore));
  const cols =
    view.boards.length <= 2
      ? "grid-cols-2"
      : view.boards.length <= 4
        ? "grid-cols-2 lg:grid-cols-4"
        : "grid-cols-3 xl:grid-cols-4";

  return (
    <div className="flex flex-1 flex-col gap-5 px-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-display text-2xl font-bold">
            Round {view.round}
            <span className="text-haze">/{view.maxRounds}</span>
          </div>
          <div className="text-sm text-haze">First to {view.targetScore} points wins</div>
        </div>

        <AnimatePresence mode="wait">
          {reveal ? (
            <motion.div
              key="reveal"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-right"
            >
              <div className="text-xs uppercase tracking-[0.3em] text-haze">The word was</div>
              <div className="font-display text-5xl font-bold tracking-[0.18em] text-neon">
                {reveal}
              </div>
            </motion.div>
          ) : view.countdownDeadline ? (
            <CountdownPill key="clock" deadline={view.countdownDeadline} className="text-2xl" />
          ) : (
            <motion.div
              key="go"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="font-display text-xl font-bold text-lime"
            >
              Race on — crack the word!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Boards */}
      <div className={cn("grid flex-1 content-start gap-4", cols)}>
        {view.boards.map((board) => (
          <PlayerCard
            key={board.playerId}
            board={board}
            view={view}
            isLeader={board.totalScore === topScore}
          />
        ))}
      </div>
    </div>
  );
}
