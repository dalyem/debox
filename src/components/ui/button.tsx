import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "text-white btn-3d bg-[linear-gradient(180deg,#a78bfa,#7c3aed)] hover:brightness-110",
        accent:
          "text-[#04222b] btn-3d bg-[linear-gradient(180deg,#67e8f9,#06b6d4)] hover:brightness-110",
        sunny:
          "text-[#3a2400] btn-3d bg-[linear-gradient(180deg,#fcd34d,#f59e0b)] hover:brightness-110",
        lime:
          "text-[#1a2e05] btn-3d bg-[linear-gradient(180deg,#bef264,#65a30d)] hover:brightness-110",
        secondary:
          "bg-secondary text-secondary-foreground border border-white/10 hover:bg-white/15",
        outline:
          "border border-white/20 bg-white/5 text-cream hover:bg-white/10",
        ghost: "text-cream hover:bg-white/10",
        danger:
          "text-white btn-3d bg-[linear-gradient(180deg,#fb7185,#e11d48)] hover:brightness-110",
        link: "text-grape-bright underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        default: "h-11 px-5 text-base",
        lg: "h-14 px-7 text-lg",
        xl: "h-16 px-9 text-xl",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
