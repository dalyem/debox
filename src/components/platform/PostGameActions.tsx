"use client";

import { motion } from "framer-motion";
import { RotateCcw, Users, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PostGameAction = "again" | "new" | "end" | null;

/**
 * The "what now?" choices a host gets when a game finishes — mirrors the
 * Jackbox end screen: replay with the same crew, reopen the lobby for a new
 * crew, or end the session and head back to the game picker.
 */
export function PostGameActions({
  onPlayAgain,
  onNewPlayers,
  onEnd,
  busy = null,
}: {
  onPlayAgain: () => void;
  onNewPlayers: () => void;
  onEnd: () => void;
  busy?: PostGameAction;
}) {
  const disabled = busy !== null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 }}
      className="flex w-[min(92vw,34rem)] flex-col gap-2.5 sm:flex-row sm:flex-wrap"
    >
      <Button
        size="lg"
        variant="lime"
        className="flex-1 font-display"
        disabled={disabled}
        onClick={onPlayAgain}
      >
        <RotateCcw className="size-5" />
        {busy === "again" ? "Dealing…" : "Play again — same players"}
      </Button>
      <Button
        size="lg"
        variant="secondary"
        className="flex-1 font-display"
        disabled={disabled}
        onClick={onNewPlayers}
      >
        <Users className="size-5" />
        {busy === "new" ? "New room…" : "Play with new players"}
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="flex-1"
        disabled={disabled}
        onClick={onEnd}
      >
        <LogOut className="size-5" />
        End session
      </Button>
    </motion.div>
  );
}
