"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Radio, Sparkles } from "lucide-react";
import { api } from "@convex/_generated/api";
import { StageShell } from "@/components/platform/StageShell";
import { DashboardHeader } from "@/components/platform/DashboardHeader";
import { RoomCard, type RoomCardData } from "@/components/platform/RoomCard";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function DashboardPage() {
  const rooms = useQuery(api.rooms.myRooms);
  const now = Date.now();
  const live = ((rooms ?? []) as RoomCardData[]).filter((r) => !r.terminal);

  return (
    <StageShell ambient={false}>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        {/* Hero CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-pop flex flex-col items-start justify-between gap-4 p-7 sm:flex-row sm:items-center"
        >
          <div>
            <h1 className="font-display text-3xl font-bold">Host a game night</h1>
            <p className="mt-1 text-haze">
              Spin up a room, throw the code on the TV, and let everyone pile in.
            </p>
          </div>
          <Button asChild size="lg" variant="lime" className="font-display text-lg">
            <Link href="/dashboard/new">
              New game <ArrowRight className="size-5" />
            </Link>
          </Button>
        </motion.div>

        {/* Live rooms */}
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Radio className="size-5 text-lime" />
            <h2 className="font-display text-xl font-bold">Live rooms</h2>
          </div>

          {rooms === undefined ? (
            <div className="flex items-center gap-2 py-10 text-haze">
              <Spinner /> Loading your rooms…
            </div>
          ) : live.length === 0 ? (
            <div className="surface flex flex-col items-center gap-3 p-10 text-center">
              <Sparkles className="size-8 text-grape-bright" />
              <div className="font-display text-lg font-bold">No live rooms yet</div>
              <p className="max-w-sm text-sm text-haze">
                Your active and lobby rooms will appear here. Start one to get the party
                going.
              </p>
              <Button asChild variant="primary">
                <Link href="/dashboard/new">Create a room</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {live.map((room) => (
                <RoomCard key={room.roomId} room={room} now={now} />
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 text-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/history">View past games →</Link>
          </Button>
        </div>
      </main>
    </StageShell>
  );
}
