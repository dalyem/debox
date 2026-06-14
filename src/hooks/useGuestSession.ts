"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type GuestSession,
  clearGuestSession,
  loadGuestSession,
  saveGuestSession,
} from "@/lib/platform/guestSession";

/**
 * Reactively read/write the guest session for a room code. Resolves after mount
 * (localStorage is client-only), so consumers should treat `loading` as the
 * "don't redirect yet" signal.
 */
export function useGuestSession(roomCode: string) {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSession(loadGuestSession(roomCode));
    setLoading(false);
  }, [roomCode]);

  const save = useCallback((next: GuestSession) => {
    saveGuestSession(next);
    setSession(next);
  }, []);

  const clear = useCallback(() => {
    clearGuestSession(roomCode);
    setSession(null);
  }, [roomCode]);

  return { session, loading, save, clear };
}
