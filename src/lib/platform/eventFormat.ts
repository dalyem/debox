import { describeCard } from "@/lib/design/cards";
import type { Card } from "@/lib/cards";

/**
 * Turn a raw event row into a friendly, animatable notification. Returns null
 * for events that are better expressed by a dedicated full-screen animation
 * (e.g. game launch / victory) rather than a toast.
 */

export type EventTone = "info" | "good" | "warn" | "big";

export interface FormattedEvent {
  emoji: string;
  text: string;
  tone: EventTone;
}

export interface RawEvent {
  seq: number;
  type: string;
  audience: string;
  payload: Record<string, unknown> | null;
}

export function formatEvent(
  e: RawEvent,
  nameOf: (id: string) => string,
): FormattedEvent | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const pid = (k: string) => nameOf(String(p[k] ?? ""));
  const card = (k: string) => describeCard(p[k] as Card);

  switch (e.type) {
    case "player_join":
      return { emoji: "🎉", text: `${p.displayName ?? "A player"} joined`, tone: "good" };
    case "player_leave":
      return { emoji: "👋", text: `${p.displayName ?? pid("playerId")} dropped`, tone: "warn" };
    case "player_reconnect":
      return { emoji: "🔌", text: `${p.displayName ?? pid("playerId")} reconnected`, tone: "info" };
    case "card_draw":
      return p.source === "discard"
        ? { emoji: "🤝", text: `${pid("playerId")} took ${card("card")}`, tone: "info" }
        : null;
    case "card_discard":
      return { emoji: "🗑️", text: `${pid("playerId")} discarded ${card("card")}`, tone: "info" };
    case "phase_complete":
      return { emoji: "✅", text: `${pid("playerId")} completed ${p.phaseName}!`, tone: "big" };
    case "hit":
      return { emoji: "➕", text: `${pid("playerId")} added to a meld`, tone: "info" };
    case "freeze":
      return {
        emoji: "❄️",
        text: `${pid("byPlayerId")} froze ${pid("targetPlayerId")}!`,
        tone: "warn",
      };
    case "turn_skipped": {
      const skipped = (p.skipped as string[] | undefined) ?? [];
      return {
        emoji: "⏭️",
        text: `${skipped.map(nameOf).join(", ")} skipped`,
        tone: "warn",
      };
    }
    case "player_out":
      return { emoji: "🏁", text: `${pid("playerId")} went out!`, tone: "big" };
    case "round_start":
      return { emoji: "🔄", text: `Round ${p.round} — new deal`, tone: "info" };
    case "game_pause":
      return { emoji: "⏸️", text: "Game paused", tone: "warn" };
    case "game_resume":
      return { emoji: "▶️", text: "Back in action", tone: "good" };
    default:
      return null;
  }
}
