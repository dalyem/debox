"use client";

import Link from "next/link";
import { StageShell } from "@/components/platform/StageShell";
import { Button } from "@/components/ui/button";

export default function HostRoomError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-6xl">🚫</div>
        <h1 className="font-display text-3xl font-bold">Can&apos;t open this room</h1>
        <p className="max-w-sm text-haze">
          It may have ended, expired, or belong to a different host account.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="primary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </StageShell>
  );
}
