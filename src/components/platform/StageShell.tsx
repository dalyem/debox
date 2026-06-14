import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The Debox "stage" background used by every full-screen surface. */
export function StageShell({
  children,
  className,
  ambient = true,
}: {
  children: ReactNode;
  className?: string;
  ambient?: boolean;
}) {
  return (
    <div className={cn("stage-bg relative min-h-dvh w-full overflow-hidden", className)}>
      {ambient ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-float absolute -left-24 top-10 size-72 rounded-full bg-grape/20 blur-3xl" />
          <div
            className="animate-float absolute -right-20 top-1/3 size-80 rounded-full bg-lagoon/15 blur-3xl"
            style={{ animationDelay: "1.5s" }}
          />
          <div
            className="animate-float absolute bottom-0 left-1/3 size-72 rounded-full bg-bubblegum/15 blur-3xl"
            style={{ animationDelay: "3s" }}
          />
        </div>
      ) : null}
      <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}
