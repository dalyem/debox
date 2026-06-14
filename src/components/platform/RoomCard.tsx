"use client";

import Link from "next/link";
import { Tv, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { GameMeta } from "@/lib/games/types";
import { ROOM_STATUS_LABELS, type RoomStatus } from "@/lib/platform/types";
import { timeAgo } from "@/lib/utils";

export interface RoomCardData {
  roomId: string;
  roomCode: string;
  status: RoomStatus;
  gameType: string;
  game: GameMeta | null;
  playerCount: number;
  createdAt: number;
  terminal: boolean;
}

const STATUS_VARIANT: Record<RoomStatus, BadgeProps["variant"]> = {
  pending: "muted",
  lobby: "lagoon",
  active: "lime",
  paused: "gold",
  ended: "grape",
  closed: "muted",
  expired: "muted",
};

export function RoomCard({ room, now }: { room: RoomCardData; now: number }) {
  const live = !room.terminal;
  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-white/[0.06] text-2xl">
            {room.game?.emoji ?? "🎲"}
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-tight">
              {room.game?.name ?? room.gameType}
            </div>
            <div className="text-xs text-haze">{timeAgo(room.createdAt, now)}</div>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[room.status]}>
          {ROOM_STATUS_LABELS[room.status]}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-sm text-haze">
        <span className="font-mono text-base tracking-[0.3em] text-cream">
          {room.roomCode}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4" />
          {room.playerCount}
        </span>
      </div>

      <Button asChild variant={live ? "primary" : "secondary"} className="w-full">
        <Link href={`/host/${room.roomId}`}>
          {live ? (
            <>
              <Tv className="size-4" /> Open TV screen
            </>
          ) : (
            <>
              <Trophy className="size-4" /> View results
            </>
          )}
        </Link>
      </Button>
    </div>
  );
}
