/**
 * Debox palette — JS-accessible color tokens.
 *
 * Used wherever colors must be computed at runtime (player chips, gradients,
 * confetti, card backs) rather than via Tailwind classes. Keys match the avatar
 * color keys in `src/lib/platform/avatars.ts`.
 */

export interface Swatch {
  solid: string;
  bright: string;
  deep: string;
  ink: string;
}

export const PALETTE: Record<string, Swatch> = {
  grape: { solid: "#8b5cf6", bright: "#a78bfa", deep: "#6d28d9", ink: "#2e1065" },
  tangerine: { solid: "#fb923c", bright: "#fdba74", deep: "#ea580c", ink: "#7c2d12" },
  lagoon: { solid: "#22d3ee", bright: "#67e8f9", deep: "#0891b2", ink: "#164e63" },
  lime: { solid: "#a3e635", bright: "#bef264", deep: "#65a30d", ink: "#365314" },
  bubblegum: { solid: "#f472b6", bright: "#f9a8d4", deep: "#db2777", ink: "#831843" },
  sky: { solid: "#38bdf8", bright: "#7dd3fc", deep: "#0284c7", ink: "#0c4a6e" },
  gold: { solid: "#fbbf24", bright: "#fcd34d", deep: "#d97706", ink: "#78350f" },
  coral: { solid: "#fb7185", bright: "#fda4af", deep: "#e11d48", ink: "#881337" },
  slate: { solid: "#94a3b8", bright: "#cbd5e1", deep: "#475569", ink: "#1e293b" },
};

export type PaletteKey = keyof typeof PALETTE;

export function paletteOf(key: string): Swatch {
  return PALETTE[key] ?? PALETTE.slate!;
}

/** A CSS linear-gradient string for a swatch. */
export function gradientOf(key: string, angle = 145): string {
  const s = paletteOf(key);
  return `linear-gradient(${angle}deg, ${s.bright}, ${s.solid} 55%, ${s.deep})`;
}
