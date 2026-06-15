"use client";

import type { PhaseCardsMove, PrivateGameView } from "@/lib/games/phase-cards/types";
import type { GameControllerProps } from "@/components/games/registry";
import { PhaseCardsController } from "./PhaseCardsController";
import { Leaderboard } from "./Leaderboard";
import { FreezeFlash } from "./FreezeFlash";
import { AnchorProvider } from "./anchors";
import { CardFlights } from "./CardFlights";

/**
 * Self-contained Phase Cards controller: the play surface plus the
 * between-rounds standings, the "you got frozen" flash, and card flights from
 * this player's perspective. The play page supplies the shell, timer and toasts.
 */
export function PhaseCardsControllerView({
  roomId,
  roomCode,
  view,
  me,
  onMove,
  submitting,
}: GameControllerProps) {
  const v = view as PrivateGameView;
  const youId = String(me.playerId);

  return (
    <AnchorProvider>
      {v.status === "round_over" || v.status === "game_over" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="text-center">
            <div className="text-3xl">🧮</div>
            <div className="font-display text-2xl font-bold">Round complete!</div>
            <p className="text-sm text-haze">Where everyone stands — next round dealing…</p>
          </div>
          <Leaderboard players={v.table} youId={youId} animate />
        </div>
      ) : (
        <>
          <PhaseCardsController
            view={v}
            onMove={onMove as (m: PhaseCardsMove) => Promise<void>}
            submitting={submitting}
            storageKey={`debox.hand.${roomCode}`}
          />
          <FreezeFlash roomId={roomId} playerId={youId} />
        </>
      )}
      <CardFlights roomId={roomId} perspectiveId={youId} />
    </AnchorProvider>
  );
}
