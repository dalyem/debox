"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

/**
 * Floating emoji reactions over the shared screen. Subscribes to the event feed,
 * ignores history on first load, and launches each fresh "reaction" as a brief
 * floater that drifts up and fades. Ephemeral — nothing is stored.
 */

interface Floater {
  key: number;
  emoji: string;
  name: string;
  x: number;
}

export function ReactionsLayer({ roomId }: { roomId: string }) {
  const events = useQuery(api.events.feed, {
    roomId: roomId as Id<"rooms">,
    limit: 24,
  });
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const seen = useRef<Set<number>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!events) return;
    if (!primed.current) {
      events.forEach((e) => seen.current.add(e.seq));
      primed.current = true;
      return;
    }
    const fresh = events.filter((e) => !seen.current.has(e.seq) && e.type === "reaction");
    if (fresh.length === 0) return;

    const additions: Floater[] = [];
    for (const e of events) {
      if (seen.current.has(e.seq)) continue;
      seen.current.add(e.seq);
      if (e.type !== "reaction") continue;
      const p = (e.payload ?? {}) as { emoji?: string; displayName?: string };
      additions.push({
        key: e.seq,
        emoji: p.emoji ?? "❓",
        name: p.displayName ?? "",
        x: 8 + Math.random() * 84, // vw, keep clear of edges
      });
    }
    if (additions.length === 0) return;
    setFloaters((prev) => [...prev, ...additions].slice(-16));
    for (const f of additions) {
      setTimeout(() => {
        setFloaters((prev) => prev.filter((x) => x.key !== f.key));
      }, 2600);
    }
  }, [events]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {floaters.map((f) => (
          <motion.div
            key={f.key}
            initial={{ opacity: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], y: -220, scale: [0.4, 1.2, 1, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: "easeOut" }}
            className="absolute bottom-16 flex flex-col items-center"
            style={{ left: `${f.x}vw` }}
          >
            <span className="text-6xl drop-shadow-lg">{f.emoji}</span>
            {f.name ? (
              <span className="rounded-full bg-black/40 px-2 py-0.5 text-xs font-semibold text-cream backdrop-blur">
                {f.name}
              </span>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
