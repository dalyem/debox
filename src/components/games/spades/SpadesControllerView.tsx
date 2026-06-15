"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Spade } from "lucide-react";
import { rankLabel, suitSymbol } from "@/lib/cards/standard";
import type { PrivateSpadesView, SpadesMove, TeamId } from "@/lib/games/spades/types";
import type { GameControllerProps } from "@/components/games/registry";
import { Avatar } from "@/components/platform/Avatar";
import { StandardCardFace } from "@/components/games/shared/StandardCardFace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TEAM_NAME: Record<TeamId, string> = { 0: "Team A", 1: "Team B" };
const TEAM_TEXT: Record<TeamId, string> = { 0: "text-lagoon", 1: "text-coral" };

/** Everyone's seat, bid and tricks — so the game is fully playable with no TV. */
function PlayersStrip({ view }: { view: PrivateSpadesView }) {
  const youId = view.you.playerId;
  return (
    <div className="flex gap-1.5 px-3 pt-2">
      {view.table.players.map((p) => {
        const current = p.playerId === view.table.currentPlayerId;
        return (
          <div
            key={p.playerId}
            className={cn(
              "min-w-0 flex-1 rounded-xl border px-1 py-1 text-center",
              current ? "border-gold/50 bg-gold/10" : "border-white/10 bg-white/[0.03]",
              !p.isActive && "opacity-60",
            )}
          >
            <div className="flex items-center justify-center gap-1">
              <Avatar color={p.avatar.color} emoji={p.avatar.emoji} size="xs" active={p.isActive} />
              <span className="truncate text-[0.6rem] font-semibold">
                {p.playerId === youId ? "You" : p.displayName}
              </span>
            </div>
            <div className={cn("text-[0.7rem] font-bold tabular-nums", TEAM_TEXT[p.team])}>
              {p.tricksWon}/{p.bid ?? "–"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrickStrip({ view }: { view: PrivateSpadesView }) {
  const plays = view.table.trick.plays;
  const nameOf = (id: string) =>
    view.table.players.find((p) => p.playerId === id)?.displayName ?? "";
  if (plays.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-haze">
        {view.phase === "bidding" ? "Bidding in progress" : "No cards played yet"}
      </div>
    );
  }
  return (
    <div className="flex h-20 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-2">
      {plays.map((pl) => (
        <div key={pl.playerId} className="flex flex-col items-center gap-0.5">
          <StandardCardFace card={pl.card} size="sm" />
          <span className="max-w-12 truncate text-[0.6rem] text-haze">{nameOf(pl.playerId)}</span>
        </div>
      ))}
    </div>
  );
}

function BidPad({
  view,
  onBid,
  submitting,
}: {
  view: PrivateSpadesView;
  onBid: (bid: number) => void;
  submitting: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const { minBid, maxBid, allowNil } = view.actions;
  const numbers: number[] = [];
  for (let n = Math.max(1, minBid); n <= maxBid; n++) numbers.push(n);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="text-center">
        <div className="font-display text-2xl font-bold">Your bid</div>
        <p className="text-sm text-haze">How many tricks will you win this hand?</p>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {allowNil ? (
          <button
            type="button"
            onClick={() => setPicked(0)}
            className={cn(
              "col-span-7 rounded-xl border py-2 font-display font-bold transition",
              picked === 0
                ? "border-lagoon bg-lagoon/20 text-lagoon"
                : "border-white/10 bg-white/5 text-haze hover:bg-white/10",
            )}
          >
            🥶 Nil (take zero)
          </button>
        ) : null}
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPicked(n)}
            className={cn(
              "aspect-square rounded-xl border font-display text-lg font-bold tabular-nums transition",
              picked === n
                ? "border-grape-bright bg-grape/30 text-cream"
                : "border-white/10 bg-white/5 text-haze hover:bg-white/10",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <Button
        size="lg"
        variant="primary"
        disabled={picked === null || submitting}
        onClick={() => picked !== null && onBid(picked)}
        className="font-display"
      >
        {picked === null ? "Pick a number" : picked === 0 ? "Bid Nil" : `Bid ${picked}`}
      </Button>
    </div>
  );
}

/** Spades controller — bid, then play legal cards; clear waiting states. */
export function SpadesControllerView({ view, onMove, submitting }: GameControllerProps) {
  const v = view as PrivateSpadesView;
  const [selected, setSelected] = useState<string | null>(null);
  const move = (m: SpadesMove) => {
    setSelected(null);
    void onMove(m);
  };

  const you = v.you;
  const table = v.table;
  const playable = new Set(v.actions.playableCardIds);
  const myTeam = table.teams[you.team];
  const oppTeam = table.teams[(you.team === 0 ? 1 : 0) as TeamId];
  const currentName =
    table.players.find((p) => p.playerId === table.currentPlayerId)?.displayName ?? "";

  if (v.status === "round_over" || v.status === "game_over") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-4xl">🧮</div>
        <div className="font-display text-2xl font-bold">Hand complete!</div>
        <p className="text-haze">
          {TEAM_NAME[you.team]}: {myTeam.score} · {TEAM_NAME[oppTeam.team]}: {oppTeam.score}
        </p>
        <p className="text-sm text-haze">Next hand dealing…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 text-sm">
        <span className="chip">
          {TEAM_NAME[you.team]} {myTeam.score} · {oppTeam.score}
        </span>
        <span className="chip">
          You: {you.tricksWon}/{you.bid ?? "–"} tricks
        </span>
        <span className={cn("chip", table.spadesBroken ? "text-gold" : "text-haze")}>
          <Spade className="size-3.5" />
        </span>
      </div>

      <PlayersStrip view={v} />

      <div className="px-3 pt-3">
        <TrickStrip view={v} />
      </div>

      {!v.isYourTurn ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-haze">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            <Avatar
              color={
                table.players.find((p) => p.playerId === table.currentPlayerId)?.avatar.color ?? "slate"
              }
              emoji={
                table.players.find((p) => p.playerId === table.currentPlayerId)?.avatar.emoji ?? "🙂"
              }
              size="lg"
            />
          </motion.div>
          <div className="font-display text-lg font-bold text-cream">
            {v.phase === "bidding" ? `${currentName} is bidding…` : `${currentName}'s turn`}
          </div>
          <p className="text-sm">Hang tight — we&apos;ll buzz you when it&apos;s your move.</p>
        </div>
      ) : v.phase === "bidding" && v.actions.canBid ? (
        <div className="flex-1 overflow-y-auto">
          <BidPad view={v} onBid={(bid) => move({ type: "bid", bid })} submitting={submitting} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-end">
          <div className="px-3 pb-1 text-center text-sm font-semibold text-lime">
            Your turn — {table.trick.ledSuit ? `follow ${suitSymbol(table.trick.ledSuit)} if you can` : "lead a card"}
          </div>
          {selected ? (
            <div className="px-3 pb-2">
              <Button
                size="lg"
                variant="lime"
                className="w-full font-display"
                disabled={submitting}
                onClick={() => move({ type: "play", cardId: selected })}
              >
                Play {(() => {
                  const c = you.hand.find((x) => x.id === selected);
                  return c ? `${rankLabel(c.rank)}${suitSymbol(c.suit)}` : "";
                })()}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* Hand — wraps so all 13 cards are visible without a scroll gesture that
          would fight card taps. */}
      <div className="max-h-[42vh] overflow-y-auto border-t border-white/10 bg-ink-2/90 px-2 pb-3 pt-2 backdrop-blur">
        <div className="flex flex-wrap justify-center gap-1">
          {you.hand.map((card) => {
            const canPlay = v.isYourTurn && v.phase === "playing" && playable.has(card.id);
            const disabled = v.phase === "playing" && v.isYourTurn && !canPlay;
            return (
              <StandardCardFace
                key={card.id}
                card={card}
                size="sm"
                selected={selected === card.id}
                dimmed={disabled}
                disabled={!canPlay}
                onClick={canPlay ? () => setSelected((s) => (s === card.id ? null : card.id)) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
