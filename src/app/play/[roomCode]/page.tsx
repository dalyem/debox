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
import { saveGuestSession } from "@/lib/platform/guestSession";
import type { GameResult } from "@/lib/games/types";
import { StageShell } from "@/components/platform/StageShell";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ControllerShell } from "@/components/controller/ControllerShell";
import { ControllerLobby } from "@/components/controller/ControllerLobby";
import { ControllerResults } from "@/components/controller/ControllerResults";
import { TurnTimer } from "@/components/platform/TurnTimer";
import { YourTurnToast } from "@/components/platform/YourTurnToast";
import { getGameViews, type PrivateBaseView, type RosterPlayer } from "@/components/games/registry";
import { ReactionFab } from "@/components/games/shared/ReactionFab";
import {
  PostGameActions,
  type PostGameAction,
} from "@/components/platform/PostGameActions";
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
  ) as (PrivateBaseView & Record<string, unknown>) | null | undefined;

  const submit = useMutation(api.gameplay.submitMove);
  const sendReaction = useMutation(api.gameplay.sendReaction);

  // Host-in-player-mode: this device may also be the authenticated host.
  const amIHost =
    useQuery(api.rooms.amIHost, roomId ? { roomId } : "skip") ?? false;
  const startGame = useMutation(api.rooms.start);
  const pauseGame = useMutation(api.rooms.pause);
  const unpauseGame = useMutation(api.rooms.unpause);
  const endGame = useMutation(api.rooms.end);
  const closeRoom = useMutation(api.rooms.close);
  const nextRound = useMutation(api.rooms.nextRound);
  const playAgainMut = useMutation(api.rooms.playAgain);
  const startFreshSessionMut = useMutation(api.rooms.startFreshSession);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [postGameBusy, setPostGameBusy] = useState<PostGameAction>(null);

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
  const roster = (players ?? []) as RosterPlayer[];
  const result = (summary.result as GameResult | null) ?? null;
  const views = summary.game ? getGameViews(summary.game.id) : null;

  const onMove = async (m: unknown) => {
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

  const react = (emoji: string) => {
    if (!roomId || !guestToken) return;
    void sendReaction({ roomId, guestToken, emoji }).catch(() => {});
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

  // The host (playing on their phone) gets the Jackbox-style end choices.
  const postGameActions =
    amIHost && status === "ended" ? (
      <PostGameActions
        busy={postGameBusy}
        onPlayAgain={async () => {
          setPostGameBusy("again");
          await hostAct(() => playAgainMut({ roomId: rid }));
          setPostGameBusy(null);
        }}
        onNewPlayers={async () => {
          setPostGameBusy("new");
          try {
            const res = await startFreshSessionMut({ roomId: rid });
            if (res.hostPlayer) {
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
            setTimeout(() => setError(null), 2800);
            setPostGameBusy(null);
          }
        }}
        onEnd={onExit}
      />
    ) : null;

  const gameLive = status === "active" && !!priv && priv.status === "in_progress";
  const reactionsOpen = status === "active" || status === "paused" || status === "ended";

  return (
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
        ) : priv === null || !views ? (
          <div className="flex flex-1 items-center justify-center text-haze">
            Waiting for the game to start…
          </div>
        ) : (
          <views.Controller
            roomId={String(rid)}
            roomCode={roomCode}
            view={priv}
            me={me as RosterPlayer}
            players={roster}
            onMove={onMove}
            submitting={submitting}
          />
        )
      ) : null}

      {status === "ended" ? (
        result ? (
          <ControllerResults
            result={result}
            players={roster}
            youId={String(me.playerId)}
            actions={postGameActions}
          />
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

      {reactionsOpen ? <ReactionFab onReact={react} /> : null}
    </ControllerShell>
  );
}
