import type { CSSProperties } from "react";
import { paletteOf } from "@/lib/design/palette";
import { cn } from "@/lib/utils";

const SIZES: Record<string, string> = {
  xs: "size-7 text-base",
  sm: "size-9 text-lg",
  md: "size-12 text-2xl",
  lg: "size-16 text-3xl",
  xl: "size-24 text-5xl",
};

export function Avatar({
  color,
  emoji,
  size = "md",
  active = true,
  className,
}: {
  color: string;
  emoji: string;
  size?: keyof typeof SIZES | string;
  active?: boolean;
  className?: string;
}) {
  const s = paletteOf(color);
  const style: CSSProperties = {
    background: `radial-gradient(circle at 32% 26%, ${s.bright}, ${s.deep})`,
    boxShadow: active
      ? `0 0 0 3px ${s.solid}44, 0 10px 22px -8px ${s.solid}`
      : "inset 0 0 0 2px rgba(255,255,255,0.08)",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition",
        SIZES[size] ?? SIZES.md,
        !active && "opacity-45 grayscale",
        className,
      )}
      style={style}
    >
      <span className="drop-shadow-sm">{emoji}</span>
    </span>
  );
}
