import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "border-white/15 bg-white/8 text-cream",
        grape: "border-grape/40 bg-grape/20 text-grape-bright",
        lagoon: "border-lagoon/40 bg-lagoon/15 text-lagoon",
        lime: "border-lime/40 bg-lime/15 text-lime",
        gold: "border-gold/40 bg-gold/15 text-gold",
        coral: "border-coral/40 bg-coral/15 text-coral",
        muted: "border-white/10 bg-white/5 text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
