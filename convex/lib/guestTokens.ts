import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Signed guest session tokens.
 *
 * Players never authenticate with an account. On join they receive a high-
 * entropy opaque token (~244 bits). The server stores only a SHA-256 hash,
 * peppered with a server-side secret (`GUEST_TOKEN_SECRET`). Because the pepper
 * never leaves the server, a hash cannot be forged or reversed — the token acts
 * as a signed bearer capability scoped to one player in one room.
 *
 * All player-authenticated functions re-derive the hash and look the player up;
 * the client is never trusted to assert its own identity.
 */

const SECRET = () => process.env.GUEST_TOKEN_SECRET ?? "debox-dev-pepper";

/** Mint a fresh, unguessable guest token. Only call inside mutations. */
export function generateGuestToken(): string {
  return `${crypto.randomUUID()}.${crypto.randomUUID()}`;
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Deterministically hash a token with the server pepper (safe in queries). */
export async function hashGuestToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(`${SECRET()}::${raw}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

/**
 * Authenticate a player from a (roomId, guestToken) pair. Throws on mismatch.
 * Returns the player document.
 */
export async function authenticatePlayer(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  guestToken: string,
): Promise<Doc<"players">> {
  if (!guestToken) throw new Error("UNAUTHENTICATED: missing guest token");
  const hash = await hashGuestToken(guestToken);
  const player = await ctx.db
    .query("players")
    .withIndex("by_room_token", (q) =>
      q.eq("roomId", roomId).eq("guestTokenHash", hash),
    )
    .unique();
  if (!player) throw new Error("FORBIDDEN: invalid session for this room");
  return player;
}
