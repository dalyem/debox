"use client";

import { AnimatePresence } from "framer-motion";
import type { PublicGameView } from "@/lib/games/phase-cards/types";
import type { GameTvProps } from "@/components/games/registry";
import { PhaseCardsTV } from "./PhaseCardsTV";
import { AnchorProvider } from "./anchors";
import { CardFlights } from "./CardFlights";
import { RoundSummary } from "./RoundSummary";

/**
 * Self-contained Phase Cards TV board: the table, the live card-flight overlay,
 * and the between-rounds scoreboard. The host page supplies the surrounding
 * chrome (header, lobby, pause overlay, victory).
 */
export function PhaseCardsTvView({ roomId, view }: GameTvProps) {
  const v = view as PublicGameView;
  return (
    <AnchorProvider>
      <CardFlights roomId={roomId} perspectiveId={null} />
      <div className="relative flex flex-1 flex-col">
        <PhaseCardsTV view={v} />
        <AnimatePresence>
          {v.status === "round_over" && v.lastRoundSummary ? (
            <RoundSummary key="round-summary" summary={v.lastRoundSummary} players={v.players} />
          ) : null}
        </AnimatePresence>
      </div>
    </AnchorProvider>
  );
}
