"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Card } from "@/lib/cards";
import { PlayingCard } from "./PlayingCard";
import { useAnchorRects } from "./anchors";

const FACE_DOWN: Card = { id: "fd", kind: "number", color: "blue", value: 0 };
const W = 64;
const H = 90;

interface Flight {
  id: string;
  from: DOMRect;
  to: DOMRect;
  card: Card;
  faceDown: boolean;
  delay: number;
}

type Rect = (key: string) => DOMRect | null;

/** Map an event to one or more card flights, from this client's perspective. */
function buildFlights(
  e: { seq: number; type: string; payload: Record<string, unknown> | null },
  perspectiveId: string | null,
  rect: Rect,
): Flight[] {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const area = (id: string) =>
    perspectiveId && id === perspectiveId ? "hand" : `player:${id}`;

  const mk = (
    fromKey: string,
    toKey: string,
    card: Card,
    faceDown: boolean,
    i = 0,
  ): Flight | null => {
    const from = rect(fromKey);
    const to = rect(toKey);
    if (!from || !to) return null;
    return { id: `${e.seq}-${i}`, from, to, card, faceDown, delay: i * 0.07 };
  };

  switch (e.type) {
    case "card_draw": {
      const pid = String(p.playerId);
      if (p.source === "discard" && p.card) {
        return [mk("discard", area(pid), p.card as Card, false)].filter(Boolean) as Flight[];
      }
      return [mk("deck", area(pid), FACE_DOWN, true)].filter(Boolean) as Flight[];
    }
    case "card_discard": {
      const pid = String(p.playerId);
      return [mk(area(pid), "discard", p.card as Card, false)].filter(Boolean) as Flight[];
    }
    case "hit": {
      const pid = String(p.playerId);
      return [
        mk(area(pid), `meld:${p.targetPlayerId}:${p.groupIndex}`, p.card as Card, false),
      ].filter(Boolean) as Flight[];
    }
    case "phase_complete": {
      const pid = String(p.playerId);
      const cards = (p.cards as Card[] | undefined) ?? [];
      return cards
        .map((c, i) => mk(area(pid), `melds:${pid}`, c, false, i))
        .filter(Boolean) as Flight[];
    }
    default:
      return [];
  }
}

function FlyingCard({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const { from, to, card, faceDown, delay } = flight;
  const start = { x: from.left + from.width / 2 - W / 2, y: from.top + from.height / 2 - H / 2 };
  const end = { x: to.left + to.width / 2 - W / 2, y: to.top + to.height / 2 - H / 2 };
  return (
    <motion.div
      initial={{ x: start.x, y: start.y, opacity: 0, scale: 0.7 }}
      animate={{
        x: end.x,
        y: end.y,
        opacity: [0, 1, 1, 0],
        scale: [0.7, 1.05, 1, 0.95],
      }}
      transition={{
        duration: 0.55,
        delay,
        ease: "easeInOut",
        opacity: { times: [0, 0.15, 0.75, 1], duration: 0.55, delay },
      }}
      onAnimationComplete={onDone}
      style={{ position: "absolute", left: 0, top: 0, width: W }}
    >
      <PlayingCard card={card} size="md" faceDown={faceDown} />
    </motion.div>
  );
}

/**
 * Watches the room event feed and animates a card flying between the relevant
 * anchors for draws, discards, hits and lay-downs. History is suppressed on
 * first load — only live events animate.
 */
export function CardFlights({
  roomId,
  perspectiveId = null,
}: {
  roomId: string;
  perspectiveId?: string | null;
}) {
  const events = useQuery(api.events.feed, {
    roomId: roomId as Id<"rooms">,
    limit: 16,
  });
  const rect = useAnchorRects();
  const [flights, setFlights] = useState<Flight[]>([]);
  const seen = useRef<Set<number>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!events) return;
    if (!primed.current) {
      events.forEach((e) => seen.current.add(e.seq));
      primed.current = true;
      return;
    }
    const adds: Flight[] = [];
    for (const e of events) {
      if (seen.current.has(e.seq)) continue;
      seen.current.add(e.seq);
      adds.push(...buildFlights(e, perspectiveId, rect));
    }
    if (adds.length > 0) setFlights((prev) => [...prev, ...adds]);
  }, [events, perspectiveId, rect]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
      <AnimatePresence>
        {flights.map((f) => (
          <FlyingCard
            key={f.id}
            flight={f}
            onDone={() =>
              setFlights((prev) => prev.filter((x) => x.id !== f.id))
            }
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
