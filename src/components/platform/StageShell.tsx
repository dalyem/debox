import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The Debox "stage" background used by every full-screen surface. */
export function StageShell({
  children,
  className,
  ambient = true,
  fill = false,
}: {
  children: ReactNode;
  className?: string;
  ambient?: boolean;
  /**
   * Lock the stage to exactly the viewport height (no page scroll, no growth).
   * Used by the phone controller so the play area always fits the screen and
   * stays the same size whether a round is live or showing the leaderboard.
   */
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "stage-bg relative w-full overflow-hidden",
        fill ? "h-dvh" : "min-h-dvh",
        className,
      )}
    >
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
      <div className={cn("relative z-10 flex flex-col", fill ? "h-full" : "min-h-dvh")}>
        {children}
      </div>
    </div>
  );
}
