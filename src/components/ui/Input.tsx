import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-12 w-full rounded-md border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/20 transition-colors",
      "aria-[invalid=true]:border-loss/60 aria-[invalid=true]:focus-visible:border-loss aria-[invalid=true]:focus-visible:ring-loss/30",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
