"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import type { Card } from "@/lib/cards";
import { PlayingCard, type PlayingCardProps } from "./PlayingCard";
import { cn } from "@/lib/utils";

/**
 * A tiny, touch-first drag-and-drop layer built on framer-motion (no extra
 * deps). Cards are free-dragged; on release we hit-test the point with
 * `elementsFromPoint` (skipping the dragged card itself) and dispatch to the
 * nearest registered drop zone — or, if released over another hand card,
 * reorder. One gesture covers both: drag a card up onto a pile/meld/slot to
 * play it, or sideways within the hand to rearrange it.
 */

type DropHandler = (card: Card) => void;
interface Zone {
  accepts: (card: Card) => boolean;
  onDrop: DropHandler;
}

interface DnDApi {
  registerZone: (id: string, zone: Zone) => void;
  unregisterZone: (id: string) => void;
  drop: (card: Card, x: number, y: number) => boolean;
  /** Called continuously during a hand drag to live-reorder under the pointer. */
  dragOver: (card: Card, x: number, y: number) => void;
  dragging: Card | null;
  setDragging: (card: Card | null) => void;
}

const Ctx = createContext<DnDApi | null>(null);

function useDnd(): DnDApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("DragDropProvider missing");
  return c;
}

export function DragDropProvider({
  children,
  onReorder,
}: {
  children: ReactNode;
  onReorder?: (cardId: string, overCardId: string) => void;
}) {
  const zones = useRef(new Map<string, Zone>());
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;
  const [dragging, setDragging] = useState<Card | null>(null);

  const registerZone = useCallback((id: string, zone: Zone) => {
    zones.current.set(id, zone);
  }, []);
  const unregisterZone = useCallback((id: string) => {
    zones.current.delete(id);
  }, []);

  const drop = useCallback((card: Card, x: number, y: number) => {
    const els = document.elementsFromPoint(x, y) as HTMLElement[];
    for (const el of els) {
      // A modal scrim (e.g. the build sheet) blocks drops from falling through
      // to the play view stacked behind it.
      if (el.dataset?.dndBarrier !== undefined) return false;
      const zid = el.dataset?.dropzone;
      if (zid) {
        const z = zones.current.get(zid);
        if (z && z.accepts(card)) {
          z.onDrop(card);
          return true;
        }
      }
    }
    return false;
  }, []);

  const dragOver = useCallback((card: Card, x: number, y: number) => {
    const els = document.elementsFromPoint(x, y) as HTMLElement[];
    for (const el of els) {
      if (el.dataset?.dndBarrier !== undefined) return; // behind a modal scrim
      if (el.dataset?.dropzone) return; // over a play target, don't reorder
      const hid = el.dataset?.handcard;
      if (hid && hid !== card.id) {
        reorderRef.current?.(card.id, hid);
        return;
      }
    }
  }, []);

  return (
    <Ctx.Provider
      value={{ registerZone, unregisterZone, drop, dragOver, dragging, setDragging }}
    >
      {children}
    </Ctx.Provider>
  );
}

/**
 * Register a drop target. Spread `dropProps` onto the element; `active` is true
 * while a compatible card is being dragged (for highlight).
 */
export function useDropZone(
  accepts: (card: Card) => boolean,
  onDrop: DropHandler,
) {
  const id = useId();
  const { registerZone, unregisterZone, dragging } = useDnd();
  const handlers = useRef({ accepts, onDrop });
  handlers.current = { accepts, onDrop };

  useEffect(() => {
    registerZone(id, {
      accepts: (c) => handlers.current.accepts(c),
      onDrop: (c) => handlers.current.onDrop(c),
    });
    return () => unregisterZone(id);
  }, [id, registerZone, unregisterZone]);

  return {
    dropProps: { "data-dropzone": id } as const,
    active: !!dragging && accepts(dragging),
  };
}

function clientPoint(e: MouseEvent | TouchEvent | PointerEvent) {
  if ("changedTouches" in e && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0]!.clientX, y: e.changedTouches[0]!.clientY };
  }
  const m = e as MouseEvent;
  return { x: m.clientX, y: m.clientY };
}

/** A hand card that can be dragged onto a drop zone (or sideways to reorder). */
export function DragCard({
  card,
  draggable = true,
  reorderable = true,
  className,
  style,
  size,
  selected,
  dimmed,
}: {
  card: Card;
  draggable?: boolean;
  /** When true (default), dragging over other hand cards live-reorders. */
  reorderable?: boolean;
  className?: string;
  style?: CSSProperties;
  size?: PlayingCardProps["size"];
  selected?: boolean;
  dimmed?: boolean;
}) {
  const { drop, dragOver, setDragging } = useDnd();

  if (!draggable) {
    return (
      <div data-handcard={card.id} className={className} style={style}>
        <PlayingCard card={card} size={size} selected={selected} dimmed={dimmed} />
      </div>
    );
  }

  return (
    <motion.div
      data-handcard={card.id}
      layout
      drag
      dragSnapToOrigin
      dragMomentum={false}
      onDragStart={() => setDragging(card)}
      onDrag={
        reorderable
          ? (e) => {
              const p = clientPoint(e as PointerEvent);
              dragOver(card, p.x, p.y);
            }
          : undefined
      }
      onDragEnd={(e) => {
        setDragging(null);
        const p = clientPoint(e as PointerEvent);
        drop(card, p.x, p.y);
      }}
      whileDrag={{ scale: 1.15, zIndex: 100 }}
      transition={{ type: "spring", stiffness: 600, damping: 40 }}
      className={cn("relative touch-none", className)}
      style={{ cursor: "grab", ...style }}
    >
      <PlayingCard card={card} size={size} selected={selected} dimmed={dimmed} />
    </motion.div>
  );
}
