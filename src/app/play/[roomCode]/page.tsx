"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { FastForward, LogOut, Pause, Play, Square } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ControllerShell } from "@/components/controller/ControllerShell";
import { ControllerLobby } from "@/components/controller/ControllerLobby";
import { ControllerResults } from "@/components/controller/ControllerResults";
import { PhaseCardsController } from "@/components/games/phase-cards/PhaseCardsController";
import { Leaderboard } from "@/components/games/phase-cards/Leaderboard";
import { FreezeFlash } from "@/components/games/phase-cards/FreezeFlash";
import { TurnTimer } from "@/components/games/phase-cards/TurnTimer";
import { YourTurnToast } from "@/components/games/phase-cards/YourTurnToast";
import { AnchorProvider } from "@/components/games/phase-cards/anchors";
import { CardFlights } from "@/components/games/phase-cards/CardFlights";
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

  // Host-in-player-mode: this device may also be the authenticated host.
  const amIHost =
    useQuery(api.rooms.amIHost, roomId ? { roomId } : "skip") ?? false;
  const startGame = useMutation(api.rooms.start);
  const pauseGame = useMutation(api.rooms.pause);
  const unpauseGame = useMutation(api.rooms.unpause);
  const endGame = useMutation(api.rooms.end);
  const closeRoom = useMutation(api.rooms.close);
  const nextRound = useMutation(api.rooms.nextRound);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);

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

  const rid = roomId as Id<"rooms">;
  const hostAct = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(cleanError(e));
      setTimeout(() => setError(null), 2800);
    }
  };
  const onStart = async () => {
    setStarting(true);
    await hostAct(() => startGame({ roomId: rid }));
    setStarting(false);
  };
  const onExit = async () => {
    await hostAct(() => closeRoom({ roomId: rid }));
    clear();
    router.push("/dashboard/new");
  };

  const roundOver = priv?.status === "round_over";
  const hostHeader =
    amIHost && (status === "active" || status === "paused") ? (
      <>
        {roundOver ? (
          <Button size="sm" variant="secondary" onClick={() => hostAct(() => nextRound({ roomId: rid }))}>
            <FastForward className="size-4" />
          </Button>
        ) : status === "active" ? (
          <Button size="sm" variant="secondary" onClick={() => hostAct(() => pauseGame({ roomId: rid }))}>
            <Pause className="size-4" />
          </Button>
        ) : (
          <Button size="sm" variant="lime" onClick={() => hostAct(() => unpauseGame({ roomId: rid }))}>
            <Play className="size-4" />
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={() => hostAct(() => endGame({ roomId: rid }))}>
          <Square className="size-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onExit} title="Close room & switch games">
          <LogOut className="size-4" />
        </Button>
      </>
    ) : null;

  const gameLive = status === "active" && !!priv && priv.status === "in_progress";

  return (
    <AnchorProvider>
    <ControllerShell
      roomCode={roomCode}
      displayName={me.displayName}
      avatar={me.avatar}
      statusLabel={ROOM_STATUS_LABELS[status]}
      turnLabel={turnLabel}
      error={error}
      headerRight={hostHeader}
      timer={
        gameLive && priv ? (
          <TurnTimer deadline={priv.turnDeadline} active={priv.isYourTurn} />
        ) : null
      }
    >
      <YourTurnToast active={gameLive && !!priv && priv.isYourTurn} />

      {status === "lobby" || status === "pending" ? (
        <ControllerLobby
          displayName={me.displayName}
          avatar={me.avatar}
          players={roster}
          game={summary.game}
          host={
            amIHost
              ? {
                  roomCode,
                  shareUrl: summary.shareUrl,
                  minPlayers: summary.minPlayers,
                  maxPlayers: summary.maxPlayers,
                  starting,
                  onStart,
                }
              : undefined
          }
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
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div className="text-center">
              <div className="text-3xl">🧮</div>
              <div className="font-display text-2xl font-bold">Round complete!</div>
              <p className="text-sm text-haze">
                Where everyone stands — next round dealing…
              </p>
            </div>
            <Leaderboard players={priv.table} youId={String(me.playerId)} animate />
          </div>
        ) : (
          <PhaseCardsController
            view={priv}
            onMove={onMove}
            submitting={submitting}
            storageKey={`debox.hand.${roomCode}`}
          />
        )
      ) : null}

      {status === "active" && priv && priv.status === "in_progress" ? (
        <FreezeFlash roomId={String(rid)} playerId={String(me.playerId)} />
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
      {gameLive ? (
        <CardFlights roomId={String(rid)} perspectiveId={String(me.playerId)} />
      ) : null}
    </AnchorProvider>
  );
}
