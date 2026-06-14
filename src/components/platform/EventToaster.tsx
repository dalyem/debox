"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { type FormattedEvent, formatEvent } from "@/lib/platform/eventFormat";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<string, string> = {
  info: "border-white/15 bg-ink-2/90",
  good: "border-lime/40 bg-lime/15",
  warn: "border-coral/40 bg-coral/15",
  big: "border-gold/50 bg-gold/15",
};

interface Toast {
  id: number;
  fmt: FormattedEvent;
}

/**
 * Subscribes to the room event feed and surfaces fresh events as transient,
 * animated toasts. History on first load is suppressed (we only animate events
 * that happen while watching).
 */
export function EventToaster({
  roomId,
  nameOf,
  audience = "tv",
  className,
}: {
  roomId: string;
  nameOf: (id: string) => string;
  audience?: "tv" | string;
  className?: string;
}) {
  const events = useQuery(api.events.feed, {
    roomId: roomId as Id<"rooms">,
    limit: 24,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<number>>(new Set());
  const primed = useRef(false);
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;

  useEffect(() => {
    if (!events) return;
    if (!primed.current) {
      events.forEach((e) => seen.current.add(e.seq));
      primed.current = true;
      return;
    }
    const fresh = events.filter((e) => !seen.current.has(e.seq));
    if (fresh.length === 0) return;

    const additions: Toast[] = [];
    for (const e of fresh) {
      seen.current.add(e.seq);
      const forMe =
        e.audience === "all" ||
        (audience === "tv" ? e.audience === "tv" : e.audience === audience);
      if (!forMe) continue;
      const fmt = formatEvent(e, nameRef.current);
      if (fmt) additions.push({ id: e.seq, fmt });
    }
    if (additions.length === 0) return;

    setToasts((prev) => [...prev, ...additions].slice(-4));
    for (const t of additions) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3600);
    }
  }, [events, audience]);

  return (
    <div
      className={cn(
        "pointer-events-none flex flex-col items-center gap-2",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 480, damping: 30 }}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur",
              TONE_STYLES[t.fmt.tone] ?? TONE_STYLES.info,
            )}
          >
            <span className="text-lg">{t.fmt.emoji}</span>
            <span>{t.fmt.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
