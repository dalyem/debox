import type { PlayerAvatar } from "./types";

/**
 * Guest avatars. Every player gets a chunky color + emoji "face" on join — no
 * accounts, no uploads, instant personality (Jackbox-style).
 *
 * Colors are design-token keys (see `src/lib/design/palette.ts`). Emoji are
 * picked to read clearly at TV distance.
 */

export const AVATAR_COLORS = [
  "grape",
  "tangerine",
  "lagoon",
  "lime",
  "bubblegum",
  "sky",
  "gold",
  "coral",
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const AVATAR_EMOJIS = [
  "🦊", "🐸", "🐙", "🦄", "🐯", "🐵", "🐼", "🐧",
  "🦁", "🐶", "🐰", "🐱", "🦉", "🐝", "🦖", "🐳",
  "👾", "🤖", "🎃", "👻", "🦕", "🐢", "🦔", "🦩",
] as const;

/**
 * Deterministically pick a distinct avatar for a seat. `salt` (e.g. a random
 * int from the join mutation) rotates the emoji so two players on the same
 * color still feel different.
 */
export function pickAvatar(seat: number, salt: number): PlayerAvatar {
  const color = AVATAR_COLORS[seat % AVATAR_COLORS.length]!;
  const emoji =
    AVATAR_EMOJIS[Math.abs((seat * 7 + salt) % AVATAR_EMOJIS.length)]!;
  return { color, emoji };
}
