"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/** Pops a banner the moment it becomes the player's turn. */
export function YourTurnToast({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);
  const prev = useRef(active);

  useEffect(() => {
    if (active && !prev.current) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 2600);
      prev.current = active;
      return () => clearTimeout(t);
    }
    prev.current = active;
  }, [active]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className="pointer-events-none fixed inset-x-0 top-16 z-50 mx-auto flex w-fit items-center gap-2 rounded-full border border-lime/50 bg-lime/20 px-5 py-2.5 font-display text-lg font-bold text-cream shadow-xl backdrop-blur"
        >
          🎯 Your turn!
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
