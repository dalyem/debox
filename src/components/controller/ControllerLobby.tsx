"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Avatar } from "@/components/platform/Avatar";
import { QrCode } from "@/components/platform/QrCode";
import { Button } from "@/components/ui/button";
import type { GameMeta } from "@/lib/games/types";

interface RosterPlayer {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  isActive: boolean;
}

export interface HostLobbyControls {
  roomCode: string;
  shareUrl: string;
  minPlayers: number;
  maxPlayers: number;
  starting?: boolean;
  onStart: () => void;
}

function Roster({ players }: { players: RosterPlayer[] }) {
  return (
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
  );
}

export function ControllerLobby({
  displayName,
  avatar,
  players,
  game,
  host,
}: {
  displayName: string;
  avatar: { color: string; emoji: string };
  players: RosterPlayer[];
  game: GameMeta | null;
  /** Present when this device is the host in "player" mode — show host controls. */
  host?: HostLobbyControls;
}) {
  if (host) {
    const canStart = players.length >= host.minPlayers;
    const joinBase = host.shareUrl
      .replace(/^https?:\/\//, "")
      .replace(new RegExp(`/${host.roomCode}$`), "");
    return (
      <div className="flex flex-1 flex-col items-center gap-5 px-6 py-6 text-center">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-haze">
            Get everyone in — go to {joinBase}
          </div>
          <div className="font-display text-6xl font-bold tracking-[0.1em] text-neon">
            {host.roomCode}
          </div>
        </div>
        <QrCode value={host.shareUrl} size={150} />
        <Roster players={players} />
        <Button
          size="xl"
          variant="lime"
          className="w-full max-w-sm font-display text-2xl"
          disabled={!canStart || host.starting}
          onClick={host.onStart}
        >
          {host.starting
            ? "Starting…"
            : canStart
              ? "Start game"
              : `Need ${host.minPlayers - players.length} more`}
        </Button>
        <p className="text-xs text-haze">
          <Users className="mr-1 inline size-3.5" />
          You&apos;re playing too — your hand is dealt when you start.
        </p>
      </div>
    );
  }

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
          {game ? game.name : "The game"} starts when the host is ready.
        </p>
      </div>

      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="chip"
      >
        Waiting for host…
      </motion.div>

      <Roster players={players} />
    </div>
  );
}
