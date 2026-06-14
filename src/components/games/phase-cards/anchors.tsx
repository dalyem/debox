"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from "react";

/**
 * A tiny anchor registry: UI elements register their DOM node under a key
 * ("deck", "discard", "hand", `player:<id>`, `meld:<id>:<i>`, `melds:<id>`), and
 * the card-flight overlay looks up their on-screen rects to animate cards
 * between them. Keeps the animation layer decoupled from layout.
 */
interface AnchorApi {
  set: (key: string, el: HTMLElement | null) => void;
  rect: (key: string) => DOMRect | null;
}

const Ctx = createContext<AnchorApi | null>(null);

export function AnchorProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, HTMLElement>());
  const set = useCallback((key: string, el: HTMLElement | null) => {
    if (el) map.current.set(key, el);
    else map.current.delete(key);
  }, []);
  const rect = useCallback(
    (key: string) => map.current.get(key)?.getBoundingClientRect() ?? null,
    [],
  );
  return <Ctx.Provider value={{ set, rect }}>{children}</Ctx.Provider>;
}

/** Returns a callback ref to attach to the element you want to anchor. */
export function useAnchor(key: string) {
  const ctx = useContext(Ctx);
  return useCallback(
    (el: HTMLElement | null) => ctx?.set(key, el),
    [ctx, key],
  );
}

/** Returns a `rect(key)` lookup (null when no provider / not registered). */
export function useAnchorRects(): (key: string) => DOMRect | null {
  const ctx = useContext(Ctx);
  return ctx ? ctx.rect : () => null;
}
