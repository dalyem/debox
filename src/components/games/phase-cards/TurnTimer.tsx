"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

/**
 * Countdown to the current turn's auto-resolve deadline. Small chip in the
 * header for everyone; a big center pulse for the active player under 15s.
 */
export function TurnTimer({
  deadline,
  active,
}: {
  deadline: number;
  active: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (!deadline) return null;
  const remaining = Math.max(0, Math.round((deadline - now) / 1000));
  if (remaining > 3600) return null; // not a real deadline
  const urgent = remaining <= 15;

  return (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono text-sm tabular-nums",
          urgent ? "font-bold text-coral" : "text-haze",
        )}
      >
        <Timer className="size-3.5" />
        {fmt(remaining)}
      </span>

      <AnimatePresence>
        {active && urgent ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          >
            <motion.div
              key={remaining}
              initial={{ scale: 1.5, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className={cn(
                "font-display text-[7rem] font-bold leading-none",
                remaining <= 5 ? "text-coral" : "text-gold",
              )}
              style={{ textShadow: "0 0 40px rgba(0,0,0,0.7)" }}
            >
              {remaining}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
