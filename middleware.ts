import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Only host surfaces require authentication. Everything a *player* touches
 * (landing, join, play, session-ended) is public — exactly like Jackbox.
 */
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/host(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files unless referenced in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
