import { Layers, ArrowRightLeft, Palette } from "lucide-react";
import type { GroupType } from "@/lib/cards/validate";
import { cn } from "@/lib/utils";

const ICONS: Record<GroupType, typeof Layers> = {
  set: Layers,
  run: ArrowRightLeft,
  color: Palette,
};

const TONE: Record<GroupType, string> = {
  set: "text-grape-bright",
  run: "text-lagoon",
  color: "text-gold",
};

export interface ObjectiveSlot {
  type: GroupType;
  count: number;
  label: string;
}

export function ObjectiveStrip({
  requirements,
  size = "md",
  className,
}: {
  requirements: ObjectiveSlot[];
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {requirements.map((req, i) => {
        const Icon = ICONS[req.type];
        return (
          <div key={i} className="flex items-center gap-2">
            {i > 0 ? (
              <span className="text-haze/60 font-display text-sm">+</span>
            ) : null}
            <span
              className={cn(
                "chip font-display",
                size === "lg" && "px-4 py-2 text-base",
                size === "sm" && "px-2.5 py-1 text-xs",
              )}
            >
              <Icon className={cn("size-4", TONE[req.type])} />
              {req.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
