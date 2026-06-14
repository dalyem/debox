import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Only host surfaces require authentication. Everything a *player* touches
 * (landing, join, play, session-ended) is public — exactly like Jackbox.
 *
 * Sign-in is a modal on the landing page (there's no standalone /sign-in
 * route), so a signed-out host hitting a protected route is sent to `/` where
 * the modal lives — rather than `auth.protect()`'s default 404.
 */
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/host(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/", req.url));
    }
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
