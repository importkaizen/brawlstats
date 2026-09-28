"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardSubtitle,
  CardTitle,
} from "@/components/ui/Card";
import { Button, buttonVariants } from "@/components/ui/Button";
import { FlashBanner, type FlashPayload } from "@/components/ui/FlashBanner";
import { Input } from "@/components/ui/Input";
import { DashboardHeader } from "./DashboardHeader";
import { isValidTag, normalizeTag } from "@/lib/tag";

export function SettingsClient({
  initial,
  canMutate = false,
}: {
  initial: {
    tag: string;
    name: string;
    slug: string;
    trackOnlyRanked: boolean;
  };
  /** Must be true to change prefs, relink tag, or delete — enforced on API too. */
  canMutate?: boolean;
}) {
  const router = useRouter();
  const [tag, setTag] = useState(initial.tag);
  const [trackOnlyRanked, setTrackOnlyRanked] = useState(
    initial.trackOnlyRanked,
  );
  const [savingFlag, setSavingFlag] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [flash, setFlash] = useState<FlashPayload | null>(null);

  const dismissFlash = useCallback(() => setFlash(null), []);

  async function saveFlag(next: boolean) {
    if (!canMutate) return;
    setSavingFlag(true);
    try {
      const res = await fetch(
        `/api/players/${encodeURIComponent(initial.slug)}/settings`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackOnlyRanked: next }),
        },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setFlash({
          variant: "error",
          message: err.error ?? "Could not save",
        });
        return;
      }
      setTrackOnlyRanked(next);
      router.refresh();
    } finally {
      setSavingFlag(false);
    }
  }

  async function relink(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    const norm = normalizeTag(tag);
    if (!isValidTag(norm)) {
      setFlash({
        variant: "error",
        message: "Tags use letters and digits, like #2YPGV0Y9.",
      });
      return;
    }
    setRelinking(true);
    try {
      const res = await fetch("/api/me/link-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: norm }),
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        player?: { slug: string };
      };
      if (!res.ok || !data.player) {
        setFlash({
          variant: "error",
          message: data.error ?? "Could not link that tag.",
        });
        return;
      }
      router.push(`/dashboard/${data.player.slug}`);
    } finally {
      setRelinking(false);
    }
  }

  async function deleteAll() {
    if (!canMutate) return;
    if (
      !confirm(
        `Delete all stored data for ${initial.tag}? This removes every battle and the player profile. The action cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/players/${initial.slug}/settings`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setFlash({
          variant: "error",
          message: err.error ?? "Could not delete data.",
        });
        return;
      }
      router.push("/");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="dashboard-shell mx-auto flex min-h-screen flex-col gap-6 px-4 pb-8 pt-4 sm:px-8">
      <DashboardHeader slug={initial.slug} active="settings" />

      <FlashBanner flash={flash} onDismiss={dismissFlash} durationMs={6000} />

      {!canMutate && (
        <div
          className="rounded-xl border border-gold/35 bg-gold/5 px-4 py-3 text-sm text-muted-foreground"
          role="note"
        >
          <span className="font-medium text-foreground">View-only:</span> sign
          in and link this tag to manage its settings and saved history.{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/dashboard/${initial.slug}/settings`)}`}
            className="font-medium text-gold underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {initial.name} <span className="text-gold">{initial.tag}</span>
        </p>
      </div>

      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div>
            <CardTitle>Tracking preferences</CardTitle>
            <CardSubtitle>
              Choose which games MyreBrawl keeps in your archive.
            </CardSubtitle>
          </div>
        </CardHeader>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={trackOnlyRanked}
            disabled={savingFlag || !canMutate}
            onChange={(e) => saveFlag(e.target.checked)}
            className="h-5 w-5 rounded border-border bg-card accent-gold"
          />
          <span>
            <span className="font-medium">Track only ranked matches</span>
            <span className="block text-xs text-muted-foreground">
              Turn off to save ladder, casual, and friendly games as well.
              Captured games stay saved after leaving the recent battle log.
            </span>
          </span>
        </label>
      </Card>

      {canMutate && (
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <div>
              <CardTitle>Re-link account</CardTitle>
              <CardSubtitle>Connect a different player tag.</CardSubtitle>
            </div>
          </CardHeader>
          <form onSubmit={relink} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="#2YPGV0Y9"
              aria-label="Player tag"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="sm:flex-1"
            />
            <Button type="submit" disabled={relinking}>
              {relinking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Linking
                </>
              ) : (
                "Re-link"
              )}
            </Button>
          </form>
        </Card>
      )}

      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div>
            <CardTitle>Export data</CardTitle>
            <CardSubtitle>Download every stored battle as CSV.</CardSubtitle>
          </div>
        </CardHeader>
        <a
          href={`/api/players/${initial.slug}/export`}
          download
          className={buttonVariants({ variant: "secondary" })}
        >
          Download CSV
        </a>
      </Card>

      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div>
            <CardTitle className="text-loss">Danger zone</CardTitle>
            <CardSubtitle>
              Permanently remove this account&apos;s data.
            </CardSubtitle>
          </div>
        </CardHeader>
        <Button
          variant="danger"
          onClick={deleteAll}
          disabled={deleting || !canMutate}
        >
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Deleting
            </>
          ) : (
            "Delete all data"
          )}
        </Button>
      </Card>
    </main>
  );
}
