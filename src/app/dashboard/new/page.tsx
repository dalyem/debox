"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Clock, Smartphone, Tv, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { GameMeta } from "@/lib/games/types";
import type { HostMode } from "@/lib/platform/types";
import { cleanError } from "@/lib/platform/errors";
import { saveGuestSession } from "@/lib/platform/guestSession";
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

  const onCreate = async (gameType: string, hostMode: HostMode) => {
    setCreating(`${gameType}:${hostMode}`);
    setError(null);
    try {
      const res = await create({ gameType, hostMode });
      if (hostMode === "player" && res.hostPlayer) {
        // Host plays too — store their guest session and drop into the controller.
        saveGuestSession({
          roomId: String(res.roomId),
          roomCode: res.roomCode,
          playerId: String(res.hostPlayer.playerId),
          guestToken: res.hostPlayer.guestToken,
          displayName: res.hostPlayer.displayName,
          avatar: res.hostPlayer.avatar,
        });
        router.push(`/play/${res.roomCode}`);
      } else {
        router.push(`/host/${res.roomId}`);
      }
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
          Choose a game, then how you&apos;re playing:{" "}
          <span className="text-cream">On a TV</span> (a shared screen, you run it)
          or <span className="text-cream">On phones</span> (no TV — you play too,
          everyone on their own phone).
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
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Button
                    size="lg"
                    variant="primary"
                    className="flex-col gap-0.5 font-display"
                    disabled={creating !== null}
                    onClick={() => onCreate(g.id, "tv")}
                  >
                    <span className="flex items-center gap-1.5">
                      <Tv className="size-4" /> On a TV
                    </span>
                    <span className="text-[0.65rem] font-normal opacity-80">
                      {creating === `${g.id}:tv` ? "Opening…" : "shared screen"}
                    </span>
                  </Button>
                  <Button
                    size="lg"
                    variant="lime"
                    className="flex-col gap-0.5 font-display"
                    disabled={creating !== null}
                    onClick={() => onCreate(g.id, "player")}
                  >
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="size-4" /> On phones
                    </span>
                    <span className="text-[0.65rem] font-normal opacity-80">
                      {creating === `${g.id}:player` ? "Opening…" : "you play too"}
                    </span>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </StageShell>
  );
}
