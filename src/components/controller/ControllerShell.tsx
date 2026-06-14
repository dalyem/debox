"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StageShell } from "@/components/platform/StageShell";
import { Avatar } from "@/components/platform/Avatar";
import { Badge } from "@/components/ui/badge";

export function ControllerShell({
  roomCode,
  displayName,
  avatar,
  statusLabel,
  turnLabel,
  error,
  headerRight,
  timer,
  children,
}: {
  roomCode: string;
  displayName: string;
  avatar: { color: string; emoji: string };
  statusLabel: string;
  turnLabel?: string;
  error?: string | null;
  headerRight?: ReactNode;
  timer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <StageShell ambient={false} className="flex">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar color={avatar.color} emoji={avatar.emoji} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-bold leading-tight">
              {displayName}
            </div>
            <div className="text-[0.7rem] text-haze">{turnLabel ?? statusLabel}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {timer}
          {headerRight}
          <Badge variant="grape" className="font-mono tracking-[0.2em]">
            {roomCode}
          </Badge>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <AnimatePresence>
          {error ? (
            <motion.div
              key={error}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="pointer-events-none absolute inset-x-0 top-2 z-50 mx-auto w-fit max-w-[90%] rounded-full border border-coral/50 bg-coral/20 px-4 py-2 text-center text-sm font-semibold text-cream shadow-lg backdrop-blur"
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {children}
      </div>
    </StageShell>
  );
}
