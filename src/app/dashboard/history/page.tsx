"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { History } from "lucide-react";
import { api } from "@convex/_generated/api";
import { StageShell } from "@/components/platform/StageShell";
import { DashboardHeader } from "@/components/platform/DashboardHeader";
import { RoomCard, type RoomCardData } from "@/components/platform/RoomCard";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function HistoryPage() {
  const rooms = useQuery(api.rooms.myRooms);
  const now = Date.now();
  const past = ((rooms ?? []) as RoomCardData[]).filter((r) => r.terminal);

  return (
    <StageShell ambient={false}>
      <DashboardHeader active="history" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        <div className="mb-5 flex items-center gap-2">
          <History className="size-6 text-grape-bright" />
          <h1 className="font-display text-3xl font-bold">Game history</h1>
        </div>

        {rooms === undefined ? (
          <div className="flex items-center gap-2 py-12 text-haze">
            <Spinner /> Loading…
          </div>
        ) : past.length === 0 ? (
          <div className="surface flex flex-col items-center gap-3 p-10 text-center">
            <div className="text-4xl">🗂️</div>
            <div className="font-display text-lg font-bold">No past games yet</div>
            <p className="max-w-sm text-sm text-haze">
              Once you finish a game, it&apos;ll land here with the final standings.
            </p>
            <Button asChild variant="primary">
              <Link href="/dashboard/new">Host your first game</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((room) => (
              <RoomCard key={room.roomId} room={room} now={now} />
            ))}
          </div>
        )}
      </main>
    </StageShell>
  );
}
