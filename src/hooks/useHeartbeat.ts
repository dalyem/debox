"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

/**
 * Keep a player marked "active" (and the room alive) while their controller is
 * open. Pings on mount, every 20s, and whenever the tab becomes visible again —
 * which doubles as the reconnect path after a phone sleeps.
 */
export function useHeartbeat(
  roomId: string | null,
  guestToken: string | null,
  enabled = true,
) {
  const heartbeat = useMutation(api.players.heartbeat);

  useEffect(() => {
    if (!enabled || !roomId || !guestToken) return;
    const ping = () => {
      void heartbeat({ roomId: roomId as Id<"rooms">, guestToken }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, guestToken, enabled, heartbeat]);
}
