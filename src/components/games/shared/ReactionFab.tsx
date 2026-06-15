"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smile } from "lucide-react";
import { ReactionBar } from "./ReactionBar";

/**
 * A small floating button on the controller that pops the reaction bar, so a
 * player can fling an emoji onto the TV without crowding the game board.
 */
export function ReactionFab({ onReact }: { onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-3 left-3 z-40 flex flex-col items-start gap-2">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="surface-pop rounded-full p-1.5"
          >
            <ReactionBar
              onReact={(emoji) => {
                onReact(emoji);
                setOpen(false);
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full border border-white/15 bg-ink-2/90 text-grape-bright shadow-lg backdrop-blur transition hover:bg-white/10"
        aria-label="Send a reaction"
      >
        <Smile className="size-5" />
      </button>
    </div>
  );
}
