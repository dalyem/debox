import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "../../src/lib/platform/types";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/** Terminal rooms (closed/expired/ended) may recycle their code. */
const NON_RECYCLABLE: Doc<"rooms">["status"][] = [
  "pending",
  "lobby",
  "active",
  "paused",
];

/** Generate a random, human-friendly room code (no ambiguous glyphs). */
export function randomRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[bytes[i]! % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

/** Allocate a code not currently used by any live (non-terminal) room. */
export async function allocateRoomCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const code = randomRoomCode();
    const clash = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("roomCode", code))
      .collect();
    const live = clash.some((r) => NON_RECYCLABLE.includes(r.status));
    if (!live) return code;
  }
  throw new Error("Could not allocate a unique room code, please retry");
}

/**
 * Resolve a room by its code. Prefers the live room; falls back to the most
 * recent terminal room with that code (so we can show "session ended").
 */
export async function findRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string,
): Promise<Doc<"rooms"> | null> {
  const normalized = code.trim().toUpperCase();
  const matches = await ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("roomCode", normalized))
    .collect();
  if (matches.length === 0) return null;
  const live = matches
    .filter((r) => NON_RECYCLABLE.includes(r.status))
    .sort((a, b) => b.createdAt - a.createdAt);
  if (live[0]) return live[0];
  return matches.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}
