/**
 * Guest session storage (client-only).
 *
 * When a player joins, the server returns a one-time signed token. We persist it
 * in localStorage keyed by room code so the player can reload / reconnect from
 * the same device without re-joining. The token is the player's capability — it
 * never leaves this device except as an argument to their own Convex calls.
 */

export interface GuestSession {
  roomId: string;
  roomCode: string;
  playerId: string;
  guestToken: string;
  displayName: string;
  avatar: { color: string; emoji: string };
}

const keyFor = (roomCode: string) => `debox.guest.${roomCode.toUpperCase()}`;

export function loadGuestSession(roomCode: string): GuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(roomCode));
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

export function saveGuestSession(session: GuestSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(session.roomCode), JSON.stringify(session));
  } catch {
    // storage might be unavailable (private mode) — non-fatal
  }
}

export function clearGuestSession(roomCode: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(roomCode));
  } catch {
    // ignore
  }
}
