import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

export function PlayerBubble({
  name,
  color,
  emoji,
  size = "md",
  active = true,
  accessory,
  className,
}: {
  name: string;
  color: string;
  emoji: string;
  size?: string;
  active?: boolean;
  accessory?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar color={color} emoji={emoji} size={size} active={active} />
      <div className="min-w-0">
        <div className="truncate font-semibold leading-tight">{name}</div>
        {accessory ? (
          <div className="text-xs text-muted-foreground">{accessory}</div>
        ) : null}
      </div>
    </div>
  );
}
