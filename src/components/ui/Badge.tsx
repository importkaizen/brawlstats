import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "win" | "loss" | "draw" | "gold" | "purple";
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground border-border",
  win: "bg-win/15 text-win border-win/20",
  loss: "bg-loss/15 text-loss border-loss/20",
  draw: "bg-draw/15 text-draw border-draw/40",
  gold: "bg-gold/15 text-gold border-gold/20",
  purple: "bg-accent-purple/15 text-accent-purple border-accent-purple/40",
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
