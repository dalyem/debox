"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Clock, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { GameMeta } from "@/lib/games/types";
import { cleanError } from "@/lib/platform/errors";
import { StageShell } from "@/components/platform/StageShell";
import { DashboardHeader } from "@/components/platform/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function NewGamePage() {
  const games = useQuery(api.games.list) as GameMeta[] | undefined;
  const create = useMutation(api.rooms.create);
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async (gameType: string) => {
    setCreating(gameType);
    setError(null);
    try {
      const res = await create({ gameType });
      router.push(`/host/${res.roomId}`);
    } catch (e) {
      setError(cleanError(e));
      setCreating(null);
    }
  };

  return (
    <StageShell ambient={false}>
      <DashboardHeader active="new" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        <h1 className="font-display text-3xl font-bold">Pick a game</h1>
        <p className="mt-1 text-haze">
          Choose what to play. We&apos;ll open a room and put the code on the big screen.
        </p>

        {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}

        {games === undefined ? (
          <div className="flex items-center gap-2 py-12 text-haze">
            <Spinner /> Loading games…
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {games.map((g, i) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="surface-pop flex flex-col gap-4 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="grid size-16 place-items-center rounded-3xl bg-white/[0.06] text-4xl">
                    {g.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-2xl font-bold">{g.name}</div>
                    <p className="text-sm text-haze">{g.tagline}</p>
                  </div>
                </div>
                <p className="text-sm text-haze">{g.description}</p>
                <div className="flex items-center gap-2 text-xs text-haze">
                  <span className="chip">
                    <Users className="size-3.5" /> {g.minPlayers}–{g.maxPlayers}
                  </span>
                  <span className="chip">
                    <Clock className="size-3.5" /> ~{g.estimatedMinutes} min
                  </span>
                </div>
                <Button
                  size="lg"
                  variant="lime"
                  className="mt-1 w-full font-display text-lg"
                  disabled={creating !== null}
                  onClick={() => onCreate(g.id)}
                >
                  {creating === g.id ? "Opening room…" : "Create room"}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </StageShell>
  );
}
