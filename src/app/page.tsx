"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { ArrowRight, Gamepad2, Tv, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { GameMeta } from "@/lib/games/types";
import { StageShell } from "@/components/platform/StageShell";
import { Wordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STEPS = [
  {
    icon: Tv,
    title: "Open a room on the TV",
    body: "Sign in, pick a game, and a big room code lands on the shared screen.",
  },
  {
    icon: Users,
    title: "Everyone grabs their phone",
    body: "Players scan the QR or punch in the code. No app, no account — just a name.",
  },
  {
    icon: Gamepad2,
    title: "Play together",
    body: "Phones are controllers, the TV is the stage. Pass, tap, and trash-talk.",
  },
];

function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase();
        if (c) router.push(`/join/${c}`);
      }}
      className="flex w-full max-w-sm gap-2"
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ROOM CODE"
        maxLength={6}
        className="text-center font-display text-xl tracking-[0.35em]"
        aria-label="Room code"
      />
      <Button type="submit" variant="lime" size="lg" disabled={!code.trim()}>
        Join <ArrowRight className="size-5" />
      </Button>
    </form>
  );
}

export default function LandingPage() {
  const games = (useQuery(api.games.list) ?? []) as GameMeta[];

  return (
    <StageShell>
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5">
        <Wordmark size={34} textClassName="text-2xl" />
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <Button variant="secondary" size="sm">
                Host sign in
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-5xl font-bold leading-[1.05] text-balance sm:text-7xl"
        >
          Game night,{" "}
          <span className="text-neon">leveled up.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-xl text-lg text-haze"
        >
          Debox turns any screen into a party. Your phone is the controller, the TV is
          the stage. Grab a room code and play in seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex w-full flex-col items-center gap-4"
        >
          <JoinByCode />
          <span className="text-sm text-haze">have a code? jump right in ☝️</span>

          <div className="mt-2 flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <Button size="lg" variant="primary" className="font-display text-lg">
                  Host a game
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button size="lg" variant="primary" className="font-display text-lg" asChild>
                <Link href="/dashboard/new">Host a game</Link>
              </Button>
            </SignedIn>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="surface flex flex-col gap-3 p-6"
            >
              <div className="flex size-11 items-center justify-center rounded-2xl bg-grape/20 text-grape-bright">
                <s.icon className="size-6" />
              </div>
              <div className="font-display text-lg font-bold">{s.title}</div>
              <p className="text-sm text-haze">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Games */}
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold">In the box</h2>
          <span className="text-sm text-haze">more games coming</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <div key={g.id} className="surface-pop flex flex-col gap-2 p-6">
              <div className="text-4xl">{g.emoji}</div>
              <div className="font-display text-xl font-bold">{g.name}</div>
              <p className="text-sm text-haze">{g.tagline}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-haze">
                <span className="chip">
                  {g.minPlayers}–{g.maxPlayers} players
                </span>
                <span className="chip">~{g.estimatedMinutes} min</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-center rounded-[1.75rem] border border-dashed border-white/15 p-6 text-center text-haze">
            <span>
              <span className="text-3xl">✨</span>
              <br />
              Trivia, drawing & more on the way
            </span>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-haze">
        Built with Next.js, Convex & Clerk · Debox
      </footer>
    </StageShell>
  );
}
