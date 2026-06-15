import { describeCard } from "@/lib/design/cards";
import type { Card } from "@/lib/cards";
import { rankPlural, rankSingular, type Rank } from "@/lib/cards/standard";

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
    case "turn_timeout":
      return { emoji: "⏰", text: `${pid("playerId")} ran out of time`, tone: "warn" };
    case "round_start":
      return { emoji: "🔄", text: `Round ${p.round} — new deal`, tone: "info" };
    case "game_pause":
      return { emoji: "⏸️", text: "Game paused", tone: "warn" };
    case "game_resume":
      return { emoji: "▶️", text: "Back in action", tone: "good" };
    case "game_replay":
      return { emoji: "🔁", text: "New game — same players!", tone: "good" };

    /* ---- Spades ---- */
    case "spades_bid": {
      const label = p.nil ? "bid nil" : `bid ${p.bid}`;
      return { emoji: p.nil ? "🥶" : "🗣️", text: `${pid("playerId")} ${label}`, tone: "info" };
    }
    case "spades_broken":
      return { emoji: "💥", text: "Spades broken!", tone: "warn" };

    /* ---- Word Rush ---- */
    case "wr_round_start":
      return { emoji: "🟩", text: `Round ${p.round} — go!`, tone: "info" };
    case "wr_solved": {
      const place = Number(p.placement ?? 0);
      const rem10 = place % 10;
      const rem100 = place % 100;
      const suffix =
        rem10 === 1 && rem100 !== 11
          ? "st"
          : rem10 === 2 && rem100 !== 12
            ? "nd"
            : rem10 === 3 && rem100 !== 13
              ? "rd"
              : "th";
      return { emoji: "🟩", text: `${pid("playerId")} cracked it — ${place}${suffix}!`, tone: "good" };
    }
    case "wr_failed":
      return { emoji: "💀", text: `${pid("playerId")} struck out`, tone: "warn" };
    case "wr_lock_start":
      return { emoji: "⏱️", text: "Clock's running — lock in!", tone: "warn" };
    case "wr_lock_shorten":
      return null; // the countdown visibly jumps; no toast needed
    case "wr_time_up":
      return { emoji: "⏰", text: "Time's up!", tone: "big" };

    /* ---- Cheat ---- */
    case "cheat_play": {
      const rank = p.claimedRank as Rank;
      const n = Number(p.count ?? 0);
      const label = n === 1 ? rankSingular(rank) : rankPlural(rank);
      return { emoji: "🃏", text: `${pid("playerId")} claims ${n} ${label}`, tone: "info" };
    }
    case "cheat_challenge": {
      const ch = (p.challenge ?? {}) as {
        challengerId: string;
        accusedId: string;
        wasBluff: boolean;
        loserId: string;
      };
      return ch.wasBluff
        ? {
            emoji: "🔥",
            text: `${nameOf(ch.accusedId)} was lying — eats the pile!`,
            tone: "big",
          }
        : {
            emoji: "🛡️",
            text: `${nameOf(ch.accusedId)} was honest — ${nameOf(ch.challengerId)} takes it`,
            tone: "big",
          };
    }

    default:
      return null;
  }
}
