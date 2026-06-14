"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Dices, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useGuestSession } from "@/hooks/useGuestSession";
import { cleanError } from "@/lib/platform/errors";
import { StageShell } from "@/components/platform/StageShell";
import { Wordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const SUGGESTIONS = [
  "Captain Chaos", "Wiggles", "Big Cheese", "Noodle", "Sir Loin", "Pixel",
  "Tater", "Boop", "Disco", "Mango", "Goose", "Zap", "Biscuit", "Waffles",
];

function Notice({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <StageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-6xl">{emoji}</div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="max-w-sm text-haze">{body}</p>
        <Button asChild variant="primary">
          <Link href="/">Back to Debox</Link>
        </Button>
      </div>
    </StageShell>
  );
}

export default function JoinPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = (params.roomCode as string).toUpperCase();
  const router = useRouter();

  const info = useQuery(api.rooms.byCode, { roomCode });
  const { session, save } = useGuestSession(roomCode);
  const join = useMutation(api.players.join);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (session) router.replace(`/play/${roomCode}`);
  }, [session, roomCode, router]);

  if (session || info === undefined) {
    return (
      <StageShell>
        <div className="flex flex-1 items-center justify-center gap-3 text-haze">
          <Spinner /> Looking up room {roomCode}…
        </div>
      </StageShell>
    );
  }

  if (!info.found) {
    return (
      <Notice
        emoji="🤔"
        title="No room here"
        body={`We couldn't find a game with code ${roomCode}. Double-check the code on the TV.`}
      />
    );
  }
  if (info.terminal) {
    return (
      <Notice
        emoji="📦"
        title="This game has ended"
        body="That session is over. Ask the host to start a new room."
      />
    );
  }
  if (info.status !== "lobby") {
    return (
      <Notice
        emoji="⏳"
        title="Already in progress"
        body="This game has already started, so the doors are closed. Catch the next round!"
      />
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setJoining(true);
    setError(null);
    try {
      const res = await join({ roomCode, displayName: trimmed });
      save({
        roomId: String(res.roomId),
        roomCode,
        playerId: String(res.playerId),
        guestToken: res.guestToken,
        displayName: trimmed,
        avatar: res.avatar,
      });
      router.replace(`/play/${roomCode}`);
    } catch (err) {
      setError(cleanError(err));
      setJoining(false);
    }
  };

  return (
    <StageShell>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <Wordmark size={34} textClassName="text-2xl" className="mb-8" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-pop w-full max-w-sm p-7"
        >
          <div className="text-center">
            <div className="font-display text-lg text-haze">
              {info.game ? `${info.game.emoji} ${info.game.name}` : "Joining"}
            </div>
            <div className="mt-1 font-display text-5xl font-bold tracking-[0.15em] text-neon">
              {roomCode}
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-haze">
              <Users className="size-4" />
              {info.playerCount}/{info.maxPlayers} players in
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <label className="text-sm font-semibold text-haze">
              Pick a name everyone&apos;ll see
            </label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={18}
                autoFocus
                className="text-lg"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Suggest a name"
                onClick={() =>
                  setName(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)]!)
                }
              >
                <Dices className="size-5" />
              </Button>
            </div>
            {error ? <p className="text-sm text-coral">{error}</p> : null}
            <Button
              type="submit"
              size="lg"
              variant="lime"
              className="mt-1 font-display text-xl"
              disabled={!name.trim() || joining}
            >
              {joining ? "Joining…" : "Let's go!"}
            </Button>
          </form>
        </motion.div>

        <p className="mt-6 max-w-xs text-center text-xs text-haze">
          No account needed. Your phone is the controller — the action happens on the
          big screen.
        </p>
      </div>
    </StageShell>
  );
}
