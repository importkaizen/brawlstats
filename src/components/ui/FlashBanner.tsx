"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FlashPayload = {
  message: string;
  variant: "success" | "error";
};

export function FlashBanner({
  flash,
  onDismiss,
  durationMs = 4200,
}: {
  flash: FlashPayload | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [flash, durationMs, onDismiss]);

  if (!flash) return null;

  return (
    <div
      role={flash.variant === "error" ? "alert" : "status"}
      aria-live={flash.variant === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-fade-in",
        flash.variant === "success" &&
          "border-win/35 bg-win/10 text-emerald-200",
        flash.variant === "error" &&
          "border-loss/40 bg-loss/10 text-loss",
      )}
    >
      <span className="min-w-0 pt-0.5 leading-snug">{flash.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-current opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(222,47%,6%)]"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
