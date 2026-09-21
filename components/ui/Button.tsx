import Link from "next/link";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * CVA-based, built on shadcn/Radix conventions (data-slot, asChild via Slot, focus-visible ring,
 * disabled state) — but with our own variant set and colors (ink/paper/surface/line/signal plus
 * money/caution/stop) fed in as the theme rather than shadcn's defaults. Real hover *shades*
 * (--color-signal-hover etc.) rather than opacity tricks, which barely read on a solid fill.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-sm hover:bg-signal-hover",
        secondary:
          "border border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-muted hover:border-muted-foreground/40",
        danger: "bg-destructive text-destructive-foreground shadow-sm hover:bg-stop-hover",
        success: "bg-money text-white shadow-sm hover:bg-money-hover",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export function buttonClasses(
  variant: VariantProps<typeof buttonVariants>["variant"] = "primary",
  size: VariantProps<typeof buttonVariants>["size"] = "md",
  className?: string,
) {
  return cn(buttonVariants({ variant, size }), className);
}

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ variant, size, asChild = false, className, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
