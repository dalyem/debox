import Link from "next/link";
import { StageShell } from "@/components/platform/StageShell";
import { Wordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <Wordmark size={34} className="mb-2" />
        <div className="font-display text-7xl font-bold text-neon">404</div>
        <p className="max-w-sm text-haze">
          This page wandered off the board. Let&apos;s get you back to the action.
        </p>
        <Button asChild variant="primary">
          <Link href="/">Back to Debox</Link>
        </Button>
      </div>
    </StageShell>
  );
}
