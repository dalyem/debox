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
import { insertionIndex } from "@/lib/games/phase-cards/handOrder";
import { PlayingCard, type PlayingCardProps } from "./PlayingCard";
import { cn } from "@/lib/utils";

/**
 * A tiny, touch-first drag-and-drop layer built on framer-motion (no extra
 * deps). One gesture does double duty: drag a hand card UP onto a
 * pile/meld/slot to play it, or sideways within the hand to rearrange it. On
 * release we hit-test the pointer with `elementsFromPoint` and either dispatch
 * to the nearest drop zone or commit a reorder.
 *
 * Reordering is *preview-then-commit*: while you drag, we expose where the card
 * would land (`preview`) so the fan can show it — but the underlying order is
 * left untouched until you let go. Previously the hand re-sorted live on every
 * pointer move, so the cards shuffled under your finger and the drop target
 * kept moving, which made placement feel slippery and unpredictable.
 *
 * The drag gesture lives on its own element and never carries framer's `layout`
 * prop: layout projection and drag both drive `transform`, and combining them
 * left cards with a stale offset (a card you could see but couldn't grab/drop).
 * Positioning/zoom animations belong on a wrapper around `DragCard`.
 */

type DropHandler = (card: Card) => void;
interface Zone {
  accepts: (card: Card) => boolean;
  onDrop: DropHandler;
}

/** Where a dragged hand card would land: its id + the insertion index among the
 *  *other* hand cards (0 = far left … n = far right). */
export interface ReorderPreview {
  id: string;
  index: number;
}

interface DnDApi {
  registerZone: (id: string, zone: Zone) => void;
  unregisterZone: (id: string) => void;
  /** Begin a drag — remember the card and snapshot the fan's geometry. */
  startDrag: (card: Card) => void;
  /** Pointer moved mid-drag — refresh the reorder preview (hand cards only). */
  moveDrag: (card: Card, x: number, y: number) => void;
  /** Released — drop on a zone, else commit the previewed reorder. */
  endDrag: (card: Card, x: number, y: number) => void;
  dragging: Card | null;
  preview: ReorderPreview | null;
}

const Ctx = createContext<DnDApi | null>(null);

function useDnd(): DnDApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("DragDropProvider missing");
  return c;
}

/**
 * Hit-test a screen point. Returns the first accepting drop zone, the string
 * `"barrier"` when a modal scrim blocks the point (so the drop can't fall
 * through to the play view behind it), or null for empty space. Elements with
 * `pointer-events: none` are skipped by `elementsFromPoint`, so a dismissed
 * scrim (which we flip to `pointer-events: none` on exit) never reads as a
 * barrier.
 */
function hitTest(
  zones: Map<string, Zone>,
  card: Card,
  x: number,
  y: number,
): Zone | "barrier" | null {
  const els = document.elementsFromPoint(x, y) as HTMLElement[];
  for (const el of els) {
    if (el.dataset?.dndBarrier !== undefined) return "barrier";
    const zid = el.dataset?.dropzone;
    if (zid) {
      const z = zones.get(zid);
      if (z && z.accepts(card)) return z;
    }
  }
  return null;
}

export function DragDropProvider({
  children,
  onReorder,
}: {
  children: ReactNode;
  /** Commit a reorder: move `cardId` to `toIndex` among the other hand cards. */
  onReorder?: (cardId: string, toIndex: number) => void;
}) {
  const zones = useRef(new Map<string, Zone>());
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;

  const [dragging, setDragging] = useState<Card | null>(null);
  const [preview, setPreviewState] = useState<ReorderPreview | null>(null);
  // Mirror the preview into a ref so `endDrag` reads a fresh value without
  // having to re-subscribe (and re-attach the framer handler) every move.
  const previewRef = useRef<ReorderPreview | null>(null);
  const setPreview = useCallback((p: ReorderPreview | null) => {
    previewRef.current = p;
    setPreviewState(p);
  }, []);

  // Fan geometry captured once at drag start: the horizontal centers of the
  // *other* hand cards (for the insertion index) and the hand's top edge (so we
  // only preview a reorder while the pointer is down in the hand band). Reading
  // a stable snapshot avoids a feedback loop as the fan opens around the gap.
  const geom = useRef<{ centers: number[]; top: number } | null>(null);

  const registerZone = useCallback((id: string, zone: Zone) => {
    zones.current.set(id, zone);
  }, []);
  const unregisterZone = useCallback((id: string) => {
    zones.current.delete(id);
  }, []);

  const startDrag = useCallback((card: Card) => {
    setDragging(card);
    setPreview(null);
    const rects = Array.from(
      document.querySelectorAll<HTMLElement>("[data-handcard]"),
    )
      .filter((el) => el.dataset.handcard !== card.id)
      .map((el) => el.getBoundingClientRect());
    geom.current = {
      centers: rects.map((r) => r.left + r.width / 2).sort((a, b) => a - b),
      top: rects.length ? Math.min(...rects.map((r) => r.top)) : 0,
    };
  }, [setPreview]);

  const moveDrag = useCallback(
    (card: Card, x: number, y: number) => {
      // Over a play target (or blocked by a scrim) → no reorder gap; the zone's
      // own highlight does the talking.
      if (hitTest(zones.current, card, x, y)) {
        if (previewRef.current) setPreview(null);
        return;
      }
      const g = geom.current;
      // Lifted out of the hand band (heading for a pile/meld) → no gap either.
      if (!g || y < g.top - 28) {
        if (previewRef.current) setPreview(null);
        return;
      }
      const index = insertionIndex(g.centers, x);
      const cur = previewRef.current;
      if (!cur || cur.id !== card.id || cur.index !== index) {
        setPreview({ id: card.id, index });
      }
    },
    [setPreview],
  );

  const endDrag = useCallback(
    (card: Card, x: number, y: number) => {
      const hit = hitTest(zones.current, card, x, y);
      const p = previewRef.current;
      if (hit && hit !== "barrier") hit.onDrop(card);
      else if (!hit && p && p.id === card.id) {
        reorderRef.current?.(card.id, p.index);
      }
      setDragging(null);
      setPreview(null);
      geom.current = null;
    },
    [setPreview],
  );

  return (
    <Ctx.Provider
      value={{
        registerZone,
        unregisterZone,
        startDrag,
        moveDrag,
        endDrag,
        dragging,
        preview,
      }}
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

/** Live reorder preview (which card is moving + where it would land), for the
 *  hand to render its insertion gap. Null when nothing is being reordered. */
export function useReorderPreview(): ReorderPreview | null {
  return useDnd().preview;
}

function clientPoint(e: MouseEvent | TouchEvent | PointerEvent) {
  if ("changedTouches" in e && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0]!.clientX, y: e.changedTouches[0]!.clientY };
  }
  const m = e as MouseEvent;
  return { x: m.clientX, y: m.clientY };
}

/** A hand card that can be dragged onto a drop zone (or sideways to reorder).
 *  Carries no `layout` prop — wrap it if you need slide/zoom animations. */
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
  /** When true (default), dragging over other hand cards previews a reorder. */
  reorderable?: boolean;
  className?: string;
  style?: CSSProperties;
  size?: PlayingCardProps["size"];
  selected?: boolean;
  dimmed?: boolean;
}) {
  const { startDrag, moveDrag, endDrag } = useDnd();

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
      drag
      dragSnapToOrigin
      dragMomentum={false}
      onDragStart={() => startDrag(card)}
      onDrag={
        reorderable
          ? (e) => {
              const p = clientPoint(e as PointerEvent);
              moveDrag(card, p.x, p.y);
            }
          : undefined
      }
      onDragEnd={(e) => {
        const p = clientPoint(e as PointerEvent);
        endDrag(card, p.x, p.y);
      }}
      whileDrag={{ scale: 1.18, zIndex: 100 }}
      transition={{ type: "spring", stiffness: 600, damping: 40 }}
      className={cn("relative touch-none", className)}
      style={{ cursor: "grab", ...style }}
    >
      <PlayingCard card={card} size={size} selected={selected} dimmed={dimmed} />
    </motion.div>
  );
}
