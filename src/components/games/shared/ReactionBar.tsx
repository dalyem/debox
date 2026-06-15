"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { REACTION_EMOJIS } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

/**
 * Controller reaction bar — fling a quick emoji onto the shared screen. Briefly
 * disables after a tap so a single thumb can't spam the feed.
 */
export function ReactionBar({
  onReact,
  className,
}: {
  onReact: (emoji: string) => void;
  className?: string;
}) {
  const [cooling, setCooling] = useState(false);

  const fire = (emoji: string) => {
    if (cooling) return;
    setCooling(true);
    onReact(emoji);
    setTimeout(() => setCooling(false), 600);
  };

  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      {REACTION_EMOJIS.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          whileTap={{ scale: 0.8 }}
          onClick={() => fire(emoji)}
          disabled={cooling}
          className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-xl transition hover:bg-white/[0.12] disabled:opacity-50"
          aria-label={`React ${emoji}`}
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  );
}
