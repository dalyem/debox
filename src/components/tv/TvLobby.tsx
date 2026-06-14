"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Smartphone, Users } from "lucide-react";
import { Avatar } from "@/components/platform/Avatar";
import { QrCode } from "@/components/platform/QrCode";
import { Button } from "@/components/ui/button";
import type { GameMeta } from "@/lib/games/types";

interface LobbyPlayer {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  isActive: boolean;
}

export function TvLobby({
  roomCode,
  shareUrl,
  game,
  players,
  minPlayers,
  maxPlayers,
  onStart,
  starting,
}: {
  roomCode: string;
  shareUrl: string;
  game: GameMeta | null;
  players: LobbyPlayer[];
  minPlayers: number;
  maxPlayers: number;
  onStart: () => void;
  starting?: boolean;
}) {
  const prettyUrl = shareUrl.replace(/^https?:\/\//, "");
  const joinBase = prettyUrl.replace(new RegExp(`/${roomCode}$`), "");
  const canStart = players.length >= minPlayers;

  return (
    <div className="grid flex-1 items-center gap-8 px-8 pb-10 lg:grid-cols-[1.1fr_1fr]">
      {/* Join instructions */}
      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-haze">
            <Smartphone className="size-5" />
            <span className="text-lg">On your phone, go to</span>
          </div>
          <div className="font-display text-3xl font-bold text-cream sm:text-4xl">
            {joinBase}
          </div>
        </div>

        <div>
          <div className="text-sm uppercase tracking-[0.3em] text-haze">Room code</div>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-display text-[6rem] font-bold leading-none tracking-[0.1em] text-neon"
          >
            {roomCode}
          </motion.div>
        </div>

        <div className="flex items-center gap-6">
          <QrCode value={shareUrl} size={168} />
          <div className="max-w-xs text-haze">
            <div className="mb-1 font-display text-lg text-cream">
              {game ? `${game.emoji} ${game.name}` : "Loading game…"}
            </div>
            <p className="text-sm">{game?.tagline}</p>
            <p className="mt-3 text-sm">Scan to hop straight in — no app, no account.</p>
          </div>
        </div>
      </div>

      {/* Player roster + start */}
      <div className="surface flex h-full flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <Users className="size-5 text-grape-bright" />
            Players
          </div>
          <span className="chip">
            {players.length}/{maxPlayers}
          </span>
        </div>

        <div className="grid flex-1 grid-cols-2 content-start gap-3 sm:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {players.map((p) => (
              <motion.div
                key={p.playerId}
                layout
                initial={{ scale: 0, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.04] p-3"
              >
                <Avatar
                  color={p.avatar.color}
                  emoji={p.avatar.emoji}
                  size="md"
                  active={p.isActive}
                />
                <span className="max-w-full truncate text-sm font-semibold">
                  {p.displayName}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {players.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-center text-haze">
              <motion.span
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-4xl"
              >
                📲
              </motion.span>
              Waiting for players to join…
            </div>
          ) : null}
        </div>

        <Button
          size="xl"
          variant="lime"
          className="w-full font-display text-2xl"
          disabled={!canStart || starting}
          onClick={onStart}
        >
          {starting
            ? "Starting…"
            : canStart
              ? "Start game"
              : `Need ${minPlayers - players.length} more`}
        </Button>
      </div>
    </div>
  );
}
