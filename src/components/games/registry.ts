import type { ComponentType } from "react";
import type { GameRuntimeStatus } from "@/lib/games/types";
import { PhaseCardsTvView } from "./phase-cards/PhaseCardsTvView";
import { PhaseCardsControllerView } from "./phase-cards/PhaseCardsControllerView";
import { SpadesTvView } from "./spades/SpadesTvView";
import { SpadesControllerView } from "./spades/SpadesControllerView";
import { CheatTvView } from "./cheat/CheatTvView";
import { CheatControllerView } from "./cheat/CheatControllerView";

/**
 * Client-side game-view registry — the UI mirror of the server's game registry.
 *
 * The host (`/host/[roomId]`) and controller (`/play/[roomCode]`) pages own all
 * the platform chrome (lobby, header, results, reactions, post-game choices) and
 * delegate the *active game board* to the views registered here, keyed by the
 * room's `gameType`. Adding a game is one entry — the pages never change.
 *
 * Every game's projections expose a small shared base (status / isYourTurn /
 * turnDeadline) so the generic pages can drive the turn timer, "your turn"
 * banner and round pacing without knowing the game.
 */

export interface RosterPlayer {
  playerId: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  seat: number;
  isActive: boolean;
}

/** Fields the generic host page reads from any game's public projection. */
export interface PublicBaseView {
  status: GameRuntimeStatus;
  round?: number;
  currentPlayerId?: string;
  turnDeadline?: number;
  turnSeq?: number;
}

/** Fields the generic controller page reads from any game's private projection. */
export interface PrivateBaseView {
  status: GameRuntimeStatus;
  isYourTurn: boolean;
  turnDeadline: number;
}

export interface GameTvProps {
  roomId: string;
  paused: boolean;
  /** The game's public projection (cast to the game's own type inside). */
  view: unknown;
  players: RosterPlayer[];
}

export interface GameControllerProps {
  roomId: string;
  roomCode: string;
  /** The game's private projection (cast to the game's own type inside). */
  view: unknown;
  me: RosterPlayer;
  players: RosterPlayer[];
  onMove: (move: unknown) => Promise<void>;
  submitting: boolean;
}

export interface GameViews {
  Tv: ComponentType<GameTvProps>;
  Controller: ComponentType<GameControllerProps>;
}

const REGISTRY: Record<string, GameViews> = {
  "phase-cards": { Tv: PhaseCardsTvView, Controller: PhaseCardsControllerView },
  spades: { Tv: SpadesTvView, Controller: SpadesControllerView },
  cheat: { Tv: CheatTvView, Controller: CheatControllerView },
};

export function getGameViews(gameType: string): GameViews | null {
  return REGISTRY[gameType] ?? null;
}
