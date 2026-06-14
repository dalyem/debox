"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Pause } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useGuestSession } from "@/hooks/useGuestSession";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { cleanError } from "@/lib/platform/errors";
import type {
  PhaseCardsMove,
  PrivateGameView,
} from "@/lib/games/phase-cards/types";
import type { GameResult } from "@/lib/games/types";
import { StageShell } from "@/components/platform/StageShell";
import { Spinner } from "@/components/ui/spinner";
import { ControllerShell } from "@/components/controller/ControllerShell";
import { ControllerLobby } from "@/components/controller/ControllerLobby";
import { ControllerResults } from "@/components/controller/ControllerResults";
import { PhaseCardsController } from "@/components/games/phase-cards/PhaseCardsController";
import { ROOM_STATUS_LABELS, type RoomStatus } from "@/lib/platform/types";

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <StageShell>
      <div className="flex flex-1 items-center justify-center gap-3 text-haze">
        <Spinner /> {label}
      </div>
    </StageShell>
  );
}

export default function PlayPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = (params.roomCode as string).toUpperCase();
  const router = useRouter();
  const { session, loading, clear } = useGuestSession(roomCode);

  const roomId = session?.roomId as Id<"rooms"> | undefined;
  const guestToken = session?.guestToken;

  useHeartbeat(roomId ?? null, guestToken ?? null, !!session);

  const summary = useQuery(api.rooms.summary, roomId ? { roomId } : "skip");
  const me = useQuery(
    api.players.me,
    roomId && guestToken ? { roomId, guestToken } : "skip",
  );
  const players = useQuery(api.players.list, roomId ? { roomId } : "skip");
  const priv = useQuery(
    api.gameplay.privateState,
    roomId && guestToken ? { roomId, guestToken } : "skip",
  ) as PrivateGameView | null | undefined;

  const submit = useMutation(api.gameplay.submitMove);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // No session for this code → go register a display name.
  useEffect(() => {
    if (!loading && !session) router.replace(`/join/${roomCode}`);
  }, [loading, session, roomCode, router]);

  // Session points at a room that's gone, or token no longer valid → re-join.
  useEffect(() => {
    if (session && (summary === null || me === null)) {
      clear();
      router.replace(`/join/${roomCode}`);
    }
  }, [session, summary, me, clear, roomCode, router]);

  if (loading || !session) return <FullScreenSpinner label="Reconnecting…" />;
  if (summary === undefined || me === undefined)
    return <FullScreenSpinner label="Joining the room…" />;
  if (summary === null || me === null)
    return <FullScreenSpinner label="Taking you back…" />;

  const status = summary.status as RoomStatus;
  const roster = players ?? [];
  const result = (summary.result as GameResult | null) ?? null;

  const onMove = async (m: PhaseCardsMove) => {
    if (!roomId || !guestToken) return;
    setSubmitting(true);
    setError(null);
    try {
      await submit({ roomId, guestToken, move: m });
    } catch (e) {
      setError(cleanError(e));
      setTimeout(() => setError(null), 2800);
    } finally {
      setSubmitting(false);
    }
  };

  const turnLabel =
    priv && (status === "active" || status === "paused")
      ? priv.isYourTurn
        ? "● Your turn"
        : ROOM_STATUS_LABELS[status]
      : ROOM_STATUS_LABELS[status];

  return (
    <ControllerShell
      roomCode={roomCode}
      displayName={me.displayName}
      avatar={me.avatar}
      statusLabel={ROOM_STATUS_LABELS[status]}
      turnLabel={turnLabel}
      error={error}
    >
      {status === "lobby" || status === "pending" ? (
        <ControllerLobby
          displayName={me.displayName}
          avatar={me.avatar}
          players={roster}
          game={summary.game}
        />
      ) : null}

      {status === "paused" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Pause className="size-12 text-grape-bright" />
          <div className="font-display text-2xl font-bold">Paused</div>
          <p className="text-haze">The host paused the game.</p>
        </div>
      ) : null}

      {status === "active" ? (
        priv === undefined ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-haze">
            <Spinner /> Dealing…
          </div>
        ) : priv === null ? (
          <div className="flex flex-1 items-center justify-center text-haze">
            Waiting for the game to start…
          </div>
        ) : priv.status === "round_over" || priv.status === "game_over" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-6">
            <div className="text-4xl">🧮</div>
            <div className="font-display text-2xl font-bold">Round complete!</div>
            <p className="text-haze">Scores are on the big screen. Next round dealing…</p>
            <Spinner />
          </div>
        ) : (
          <PhaseCardsController view={priv} onMove={onMove} submitting={submitting} />
        )
      ) : null}

      {status === "ended" ? (
        result ? (
          <ControllerResults result={result} players={roster} youId={String(me.playerId)} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-haze">
            Wrapping up…
          </div>
        )
      ) : null}

      {status === "closed" || status === "expired" ? (
        result ? (
          <ControllerResults result={result} players={roster} youId={String(me.playerId)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="text-5xl">📦</div>
            <div className="font-display text-2xl font-bold">This session has ended.</div>
            <p className="text-haze">Thanks for playing!</p>
          </div>
        )
      ) : null}
    </ControllerShell>
  );
}
