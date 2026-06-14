import type { Card, CardColor } from "@/lib/cards";

/**
 * Visual styling for playing cards. Distinct, saturated colors readable at TV
 * distance, plus suit-like glyphs that reinforce color for accessibility.
 */

export interface CardFace {
  from: string;
  to: string;
  text: string;
  glow: string;
  glyph: string;
  label: string;
}

export const CARD_COLOR_FACES: Record<CardColor, CardFace> = {
  red: { from: "#ff6b81", to: "#e11d48", text: "#fff5f6", glow: "#fb7185", glyph: "◆", label: "Crimson" },
  blue: { from: "#56ccf2", to: "#2563eb", text: "#f0f9ff", glow: "#38bdf8", glyph: "●", label: "Cobalt" },
  green: { from: "#5be584", to: "#16a34a", text: "#f0fff4", glow: "#4ade80", glyph: "▲", label: "Clover" },
  yellow: { from: "#ffd84d", to: "#f59e0b", text: "#3a2400", glow: "#fcd34d", glyph: "★", label: "Sunny" },
};

export const WILD_FACE = {
  from: "#a78bfa",
  to: "#7c3aed",
  text: "#faf5ff",
  glow: "#c4b5fd",
  glyph: "✶",
  label: "Shift",
};

export const FREEZE_FACE = {
  from: "#67e8f9",
  to: "#0891b2",
  text: "#ecfeff",
  glow: "#a5f3fc",
  glyph: "❄",
  label: "Freeze",
};

export function faceOf(card: Card): {
  from: string;
  to: string;
  text: string;
  glow: string;
  glyph: string;
  label: string;
} {
  if (card.kind === "wild") return WILD_FACE;
  if (card.kind === "freeze") return FREEZE_FACE;
  return CARD_COLOR_FACES[card.color ?? "red"];
}

/** Short human label for a card, used in event toasts. */
export function describeCard(card: Card): string {
  if (card.kind === "wild") return "Shift";
  if (card.kind === "freeze") return "Freeze";
  return `${CARD_COLOR_FACES[card.color ?? "red"].label} ${card.value}`;
}
