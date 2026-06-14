/**
 * Platform-level shared types.
 *
 * These describe the *platform* contract (rooms, players, sessions, events)
 * that every game plugs into. They are intentionally game-agnostic — a trivia
 * game and a card game both speak this vocabulary. Game-specific shapes live in
 * each game module under `src/lib/games/<id>/`.
 */

/** The lifecycle of a room, mirrored 1:1 in the Convex schema. */
export type RoomStatus =
  | "pending" // created, not yet open for joins
  | "lobby" // open, players joining, game not started
  | "active" // game in progress
  | "paused" // host paused the game
  | "ended" // game finished, results visible
  | "closed" // host closed the room (terminal)
  | "expired"; // auto-expired due to inactivity (terminal)

export const TERMINAL_ROOM_STATUSES: RoomStatus[] = ["closed", "expired"];

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  pending: "Getting ready",
  lobby: "In the lobby",
  active: "Playing",
  paused: "Paused",
  ended: "Finished",
  closed: "Closed",
  expired: "Expired",
};

export function isRoomJoinable(status: RoomStatus): boolean {
  return status === "lobby";
}

export function isRoomPlayable(status: RoomStatus): boolean {
  return status === "active" || status === "paused";
}

export function isRoomTerminal(status: RoomStatus): boolean {
  return TERMINAL_ROOM_STATUSES.includes(status) || status === "ended";
}

/** A whimsical avatar assigned to each guest on join. */
export interface PlayerAvatar {
  /** Design-token color key (see `src/lib/design/palette.ts`). */
  color: string;
  /** Emoji glyph rendered as the player's face. */
  emoji: string;
}

/**
 * The minimal, non-secret view of a player handed to game engines. Game
 * engines never see guest tokens or connection details — only identity + seat.
 */
export interface SeatedPlayer {
  playerId: string;
  displayName: string;
  seat: number;
  avatar: PlayerAvatar;
  isActive: boolean;
}

/** Who an event animation/notification is meant for. */
export type EventAudience = "tv" | "all" | { playerId: string };

/** Categories the Event Engine knows how to animate on the TV + controllers. */
export type PlatformEventType =
  | "player_join"
  | "player_leave"
  | "player_reconnect"
  | "game_launch"
  | "game_pause"
  | "game_resume"
  | "game_end"
  | "room_close";

export const ROOM_CODE_LENGTH = 4;
/** Unambiguous alphabet — no 0/O/1/I/L to keep codes readable on a TV. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Idle time after which an un-started/abandoned room auto-expires. */
export const ROOM_IDLE_EXPIRY_MS = 1000 * 60 * 60 * 3; // 3 hours
/** A finished room is auto-closed and swept after this grace period. */
export const ROOM_ENDED_GRACE_MS = 1000 * 60 * 30; // 30 minutes
/** A player is considered disconnected after missing heartbeats this long. */
export const PLAYER_HEARTBEAT_TIMEOUT_MS = 1000 * 45;
