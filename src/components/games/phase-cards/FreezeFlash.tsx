"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

/**
 * Full-screen flash when *you* get frozen — fired the moment your turn is
 * actually skipped (and as a heads-up when the Freeze is played at you), so it's
 * obvious why your turn vanished.
 */
export function FreezeFlash({
  roomId,
  playerId,
}: {
  roomId: string;
  playerId: string;
}) {
  const events = useQuery(api.events.feed, {
    roomId: roomId as Id<"rooms">,
    limit: 12,
  });
  const seen = useRef<Set<number>>(new Set());
  const primed = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!events) return;
    if (!primed.current) {
      events.forEach((e) => seen.current.add(e.seq));
      primed.current = true;
      return;
    }
    let next: string | null = null;
    for (const e of events) {
      if (seen.current.has(e.seq)) continue;
      seen.current.add(e.seq);
      const p = (e.payload ?? {}) as Record<string, unknown>;
      if (
        e.type === "turn_skipped" &&
        Array.isArray(p.skipped) &&
        (p.skipped as string[]).includes(playerId)
      ) {
        next = "Your turn was skipped";
      } else if (e.type === "freeze" && p.targetPlayerId === playerId && !next) {
        next = "You'll skip your next turn";
      }
    }
    if (next) setMessage(next);
  }, [events, playerId]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center bg-lagoon/20 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -18 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 13 }}
            className="text-center"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="text-8xl drop-shadow"
            >
              ❄️
            </motion.div>
            <div className="mt-2 font-display text-4xl font-bold text-glow">Frozen!</div>
            <div className="text-haze">{message}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
