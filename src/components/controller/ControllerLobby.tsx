"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/platform/Avatar";
import type { GameMeta } from "@/lib/games/types";

interface RosterPlayer {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  isActive: boolean;
}

export function ControllerLobby({
  displayName,
  avatar,
  players,
  game,
}: {
  displayName: string;
  avatar: { color: string; emoji: string };
  players: RosterPlayer[];
  game: GameMeta | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 px-6 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <Avatar color={avatar.color} emoji={avatar.emoji} size="xl" />
      </motion.div>

      <div>
        <div className="font-display text-3xl font-bold">
          You&apos;re in, {displayName}!
        </div>
        <p className="mt-1 text-haze">
          Look up at the big screen — {game ? game.name : "the game"} starts when the
          host is ready.
        </p>
      </div>

      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="chip"
      >
        Waiting for host…
      </motion.div>

      <div className="w-full max-w-sm">
        <div className="mb-2 text-xs uppercase tracking-[0.25em] text-haze">
          In the room ({players.length})
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {players.map((p) => (
            <div key={p.playerId} className="flex flex-col items-center gap-1">
              <Avatar
                color={p.avatar.color}
                emoji={p.avatar.emoji}
                size="sm"
                active={p.isActive}
              />
              <span className="max-w-16 truncate text-xs text-haze">
                {p.displayName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
