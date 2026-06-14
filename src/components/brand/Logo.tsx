import { cn } from "@/lib/utils";

/** The Debox box mark: a chunky box with two cards springing out of it. */
export function Logo({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={cn("drop-glow", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dbx-box" x1="8" y1="22" x2="56" y2="58">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="dbx-card-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="dbx-card-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* cards popping out the top */}
      <rect
        x="16"
        y="8"
        width="16"
        height="22"
        rx="3.5"
        fill="url(#dbx-card-a)"
        stroke="#0a0717"
        strokeWidth="2"
        transform="rotate(-20 24 19)"
      />
      <rect
        x="30"
        y="6"
        width="16"
        height="22"
        rx="3.5"
        fill="url(#dbx-card-b)"
        stroke="#0a0717"
        strokeWidth="2"
        transform="rotate(18 38 17)"
      />

      {/* box body */}
      <rect
        x="11"
        y="25"
        width="42"
        height="31"
        rx="9"
        fill="url(#dbx-box)"
        stroke="#0a0717"
        strokeWidth="2.5"
      />
      {/* top highlight band */}
      <path
        d="M20 25h24a9 9 0 0 1 9 9v0H11v0a9 9 0 0 1 9-9Z"
        fill="#ffffff"
        fillOpacity="0.16"
      />
      {/* slot / mouth */}
      <rect x="25" y="44" width="14" height="4" rx="2" fill="#0a0717" fillOpacity="0.45" />
    </svg>
  );
}

/** Logo + animated neon wordmark. */
export function Wordmark({
  className,
  size = 40,
  textClassName,
}: {
  className?: string;
  size?: number;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <span
        className={cn(
          "font-display text-3xl font-bold tracking-tight text-neon",
          textClassName,
        )}
      >
        Debox
      </span>
    </span>
  );
}
