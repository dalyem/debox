import Link from "next/link";
import { StageShell } from "@/components/platform/StageShell";
import { Wordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Session ended" };

export default function SessionEndedPage() {
  return (
    <StageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Wordmark size={36} className="mb-2" />
        <div className="text-6xl">📦</div>
        <h1 className="font-display text-4xl font-bold">This game session has ended.</h1>
        <p className="max-w-md text-haze">
          The room is closed and can&apos;t be reopened. Start a fresh game any time —
          it only takes a moment.
        </p>
        <Button asChild variant="primary" size="lg">
          <Link href="/">Back to Debox</Link>
        </Button>
      </div>
    </StageShell>
  );
}
