"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Pause,
  Play,
  Square,
  LayoutDashboard,
  FastForward,
  LogOut,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { GameResult } from "@/lib/games/types";
import { StageShell } from "@/components/platform/StageShell";
import { EventToaster } from "@/components/platform/EventToaster";
import { Victory } from "@/components/platform/Victory";
import { Wordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TvLobby } from "@/components/tv/TvLobby";
import { getGameViews, type PublicBaseView } from "@/components/games/registry";
import { ReactionsLayer } from "@/components/games/shared/ReactionsLayer";
import {
  PostGameActions,
  type PostGameAction,
} from "@/components/platform/PostGameActions";
import { ROOM_STATUS_LABELS, type RoomStatus } from "@/lib/platform/types";

export default function HostRoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params.roomId as Id<"rooms">;

  const data = useQuery(api.rooms.hostRoom, { roomId });
  const publicState = useQuery(api.gameplay.publicState, { roomId }) as
    | (PublicBaseView & Record<string, unknown>)
    | null
    | undefined;

  const start = useMutation(api.rooms.start);
  const pause = useMutation(api.rooms.pause);
  const unpause = useMutation(api.rooms.unpause);
  const end = useMutation(api.rooms.end);
  const close = useMutation(api.rooms.close);
  const nextRound = useMutation(api.rooms.nextRound);
  const playAgain = useMutation(api.rooms.playAgain);
  const startFreshSession = useMutation(api.rooms.startFreshSession);

  const [starting, setStarting] = useState(false);
  const [postGameBusy, setPostGameBusy] = useState<PostGameAction>(null);

  const postGameActions = (
    <PostGameActions
      busy={postGameBusy}
      onPlayAgain={async () => {
        setPostGameBusy("again");
        try {
          await playAgain({ roomId });
        } catch {
          // e.g. players left and we're now below the minimum — the host can
          // fall back to "new players" to reopen the lobby instead.
        } finally {
          setPostGameBusy(null);
        }
      }}
      onNewPlayers={async () => {
        setPostGameBusy("new");
        try {
          const res = await startFreshSession({ roomId });
          router.push(`/host/${res.roomId}`); // fresh code, same game + settings
        } catch {
          setPostGameBusy(null);
        }
      }}
      onEnd={async () => {
        setPostGameBusy("end");
        await close({ roomId });
        router.push("/dashboard/new");
      }}
    />
  );

  const nameOf = useMemo(() => {
    const map = new Map((data?.players ?? []).map((p) => [String(p.playerId), p.displayName]));
    return (id: string) => map.get(id) ?? "Someone";
  }, [data?.players]);

  if (data === undefined) {
    return (
      <StageShell>
        <div className="flex flex-1 items-center justify-center gap-3 text-haze">
          <Spinner /> Loading room…
        </div>
      </StageShell>
    );
  }

  const status = data.room.status as RoomStatus;
  const game = data.game;
  const views = game ? getGameViews(game.id) : null;
  const view = publicState ?? null;
  const roundOver = view?.status === "round_over";
  const result = (data.room.result as GameResult | null) ?? null;
  const isTerminal = status === "ended" || status === "closed" || status === "expired";
  const showResults = !!result && (isTerminal || view?.status === "game_over");
  const inGame = status === "active" || status === "paused";
  const reactionsOpen = inGame || status === "ended";

  return (
    <StageShell>
      {reactionsOpen ? <ReactionsLayer roomId={String(roomId)} /> : null}

      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <Wordmark size={32} textClassName="text-2xl" />
          {game ? (
            <span className="hidden font-display text-lg text-haze sm:inline">
              {game.emoji} {game.name}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="grape" className="font-mono text-sm tracking-[0.3em]">
            {data.room.roomCode}
          </Badge>
          <Badge variant="muted">{ROOM_STATUS_LABELS[status]}</Badge>

          {!isTerminal ? (
            <ExitButton
              playerCount={data.players.length}
              inGame={inGame}
              onConfirm={async () => {
                await close({ roomId });
                router.push("/dashboard/new");
              }}
            />
          ) : null}

          {inGame && (
            <>
              {roundOver ? (
                <Button size="sm" variant="secondary" onClick={() => nextRound({ roomId })}>
                  <FastForward className="size-4" /> Deal now
                </Button>
              ) : status === "active" ? (
                <Button size="sm" variant="secondary" onClick={() => pause({ roomId })}>
                  <Pause className="size-4" /> Pause
                </Button>
              ) : (
                <Button size="sm" variant="lime" onClick={() => unpause({ roomId })}>
                  <Play className="size-4" /> Resume
                </Button>
              )}
              <EndGameButton onConfirm={() => end({ roomId })} />
            </>
          )}

          {status === "closed" || status === "expired" ? (
            <Button size="sm" variant="primary" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" /> Dashboard
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {/* Event notifications */}
      <div className="pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2">
        <EventToaster roomId={String(roomId)} nameOf={nameOf} audience="tv" />
      </div>

      {/* Body */}
      {status === "lobby" || status === "pending" ? (
        <TvLobby
          roomCode={data.room.roomCode}
          shareUrl={data.room.shareUrl}
          game={game}
          players={data.players}
          minPlayers={data.room.minPlayers}
          maxPlayers={data.room.maxPlayers}
          starting={starting}
          onStart={async () => {
            setStarting(true);
            try {
              await start({ roomId });
            } finally {
              setStarting(false);
            }
          }}
        />
      ) : null}

      {inGame && view && views ? (
        <div className="relative flex flex-1 flex-col">
          <views.Tv
            roomId={String(roomId)}
            paused={status === "paused"}
            view={view}
            players={data.players}
          />

          {status === "paused" ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="surface-pop px-10 py-8 text-center"
              >
                <Pause className="mx-auto size-12 text-grape-bright" />
                <div className="mt-3 font-display text-3xl font-bold">Paused</div>
                <p className="text-haze">The host will resume shortly.</p>
              </motion.div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showResults && result ? (
        <Victory
          result={result}
          players={data.players}
          actions={status === "ended" ? postGameActions : undefined}
        />
      ) : null}

      {(status === "closed" || status === "expired") && !result ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-6xl">📦</div>
          <h1 className="font-display text-4xl font-bold">This room is {status}.</h1>
          <Button asChild variant="primary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      ) : null}
    </StageShell>
  );
}

function ExitButton({
  playerCount,
  inGame,
  onConfirm,
}: {
  playerCount: number;
  inGame: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [leaving, setLeaving] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Close this room and pick another game">
          <LogOut className="size-4" /> Exit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave & switch games?</DialogTitle>
          <DialogDescription>
            This closes the room{" "}
            {playerCount > 0
              ? `and disconnects ${playerCount} ${playerCount === 1 ? "player" : "players"}`
              : ""}
            {inGame ? ", ending the current game," : ""} and takes you back to game
            selection. It can&apos;t be reopened.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Stay here</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              try {
                await onConfirm();
              } catch {
                setLeaving(false);
              }
            }}
          >
            {leaving ? "Closing…" : "Exit to game picker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndGameButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="danger">
          <Square className="size-4" /> End
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End the game?</DialogTitle>
          <DialogDescription>
            This finishes the game for everyone and shows the final standings. You
            can&apos;t undo it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep playing</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger" onClick={onConfirm}>
              End game
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
