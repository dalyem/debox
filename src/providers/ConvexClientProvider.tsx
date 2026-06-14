"use client";

import { type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";

/**
 * Wires the reactive Convex client to Clerk auth. `ConvexProviderWithClerk`
 * keeps the host's Convex auth token fresh; guest (player) calls pass a signed
 * token argument instead and need no Clerk session.
 *
 * A placeholder URL is used when the env var is missing so `next build` never
 * crashes during prerender; the real URL is required at runtime.
 */
const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://placeholder.convex.cloud",
);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
