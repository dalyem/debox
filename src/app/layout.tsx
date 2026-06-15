import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ConvexClientProvider } from "@/providers/ConvexClientProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Debox — Party games for your living room",
    template: "%s · Debox",
  },
  description:
    "Debox turns any screen into a game night. Your phone is the controller, the TV is the stage. No apps, no accounts for players — just a room code.",
  applicationName: "Debox",
  openGraph: {
    title: "Debox — Party games for your living room",
    description:
      "Your phone is the controller. The TV is the stage. Grab a room code and play.",
    type: "website",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0717",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// A build-safe placeholder lets `next build` prerender the pages that mount
// ClerkProvider even when the real key is absent — e.g. a Vercel Preview env or
// a fresh clone — instead of crashing with "Missing publishableKey". Mirrors
// the Convex URL fallback in ConvexClientProvider; the real key is required for
// auth at runtime. (Decodes to the dummy frontend API "clerk.placeholder.dev".)
const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  "pk_test_Y2xlcmsucGxhY2Vob2xkZXIuZGV2JA==";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: "#8b5cf6",
          colorBackground: "#140c28",
          colorInputBackground: "#1b1338",
          colorText: "#fbf7ff",
          colorTextSecondary: "#a99fce",
          colorInputText: "#fbf7ff",
          borderRadius: "0.9rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        },
        elements: {
          card: "shadow-2xl",
        },
      }}
    >
      <html
        lang="en"
        className={`${inter.variable} ${fredoka.variable}`}
        suppressHydrationWarning
      >
        <body className="min-h-dvh antialiased">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
