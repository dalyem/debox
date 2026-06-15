"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { rankPlural } from "@/lib/cards/standard";
import type { ChallengeResult } from "@/lib/games/cheat/types";
import { StandardCardFace } from "@/components/games/shared/StandardCardFace";
import { cn } from "@/lib/utils";

/**
 * The dramatic "CHEAT!" reveal. Self-contained: it watches the latest resolved
 * challenge and, when a *new* one arrives, flips the hidden cards face-up, shows
 * the verdict, and announces who ate the pile — then fades. History on first
 * mount is suppressed so a reconnect doesn't replay an old reveal.
 */
export function CheatRevealOverlay({
  challenge,
  nameOf,
  compact = false,
}: {
  challenge: ChallengeResult | null;
  nameOf: (id: string) => string;
  compact?: boolean;
}) {
  const [shown, setShown] = useState<ChallengeResult | null>(null);
  const lastSig = useRef<string | null>(null);
  const primed = useRef(false);

  const sig = challenge
    ? `${challenge.accusedId}:${challenge.challengerId}:${challenge.pileSize}:${challenge.wasBluff}`
    : null;

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      lastSig.current = sig;
      return;
    }
    if (sig && sig !== lastSig.current) {
      lastSig.current = sig;
      setShown(challenge);
      const t = setTimeout(() => setShown(null), 4200);
      return () => clearTimeout(t);
    }
  }, [sig, challenge]);

  return (
    <AnimatePresence>
      {shown ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 14 }}
            className="flex flex-col items-center gap-4 px-6 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: 3, duration: 0.5 }}
              className="font-display text-6xl font-black tracking-tight text-coral drop-glow sm:text-8xl"
            >
              CHEAT!
            </motion.div>
            <div className="text-haze">
              {nameOf(shown.challengerId)} called out {nameOf(shown.accusedId)} —{" "}
              they claimed {rankPlural(shown.claimedRank)}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {shown.revealed.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ rotateY: 180, opacity: 0, y: 20 }}
                  animate={{ rotateY: 0, opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.18, type: "spring", stiffness: 260, damping: 18 }}
                >
                  <StandardCardFace card={card} size={compact ? "md" : "lg"} />
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 + shown.revealed.length * 0.18 + 0.2 }}
              className={cn(
                "rounded-full px-5 py-2 font-display text-xl font-bold",
                shown.wasBluff ? "bg-coral/25 text-coral" : "bg-lime/25 text-lime",
              )}
            >
              {shown.wasBluff ? "Caught lying! 🤥" : "Telling the truth! 🛡️"}
            </motion.div>
            <div className="font-semibold text-cream">
              {nameOf(shown.loserId)} picks up {shown.pileSize}{" "}
              {shown.pileSize === 1 ? "card" : "cards"}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
