"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Share the join link.
 *
 * Uses the native Web Share sheet (`navigator.share`) when available — the best
 * experience on phones, letting the host fire the link straight into Messages,
 * WhatsApp, etc. Falls back to copying the link to the clipboard (with a brief
 * "copied" confirmation) on desktop or where sharing isn't supported.
 */
export function ShareButton({
  url,
  roomCode,
  gameName,
  label = "Share invite",
  variant = "secondary",
  size = "default",
  className,
}: {
  url: string;
  roomCode?: string;
  gameName?: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const text = `Join my ${gameName ?? "Debox"} game${roomCode ? ` — code ${roomCode}` : ""}!`;
    const nav = typeof navigator !== "undefined" ? navigator : undefined;

    if (nav?.share) {
      try {
        await nav.share({ title: gameName ? `${gameName} on Debox` : "Debox", text, url });
        return;
      } catch (err) {
        // User dismissed the share sheet — leave it at that.
        if (err instanceof Error && err.name === "AbortError") return;
        // Otherwise fall through to the clipboard fallback.
      }
    }

    try {
      await nav?.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No share, no clipboard — nothing more we can do.
    }
  };

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={onShare}>
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Link copied!" : label}
    </Button>
  );
}
