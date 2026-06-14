"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { History, Plus } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export function DashboardHeader({ active }: { active?: "new" | "history" }) {
  return (
    <header className="flex items-center justify-between gap-3 px-6 py-5">
      <Link href="/dashboard" aria-label="Debox dashboard">
        <Wordmark size={30} textClassName="text-xl" />
      </Link>
      <nav className="flex items-center gap-2">
        <Button
          asChild
          variant={active === "new" ? "primary" : "secondary"}
          size="sm"
        >
          <Link href="/dashboard/new">
            <Plus className="size-4" /> New game
          </Link>
        </Button>
        <Button
          asChild
          variant={active === "history" ? "primary" : "ghost"}
          size="sm"
        >
          <Link href="/dashboard/history">
            <History className="size-4" /> History
          </Link>
        </Button>
        <div className="ml-1">
          <UserButton />
        </div>
      </nav>
    </header>
  );
}
