import type { AuthConfig } from "convex/server";

/**
 * Tells Convex how to validate the JWTs minted by Clerk.
 *
 * `CLERK_JWT_ISSUER_DOMAIN` is set in the *Convex* dashboard (Settings →
 * Environment Variables). It is the "Issuer" of the Clerk JWT template named
 * `convex`. See docs/DEPLOYMENT.md for the one-time setup.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
