"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { isValidTag, normalizeTag } from "@/lib/tag";
import { Loader2 } from "lucide-react";

type ApiError = { error?: string; hint?: string; code?: string };

export function ConnectForm({
  initialTag = "",
  className,
  /** When true, POST `/api/me/link-tag` as a signed-in user (saves tag to your account). */
  linkToMyAccount = false,
}: {
  initialTag?: string;
  className?: string;
  linkToMyAccount?: boolean;
}) {
  const router = useRouter();
  const [tag, setTag] = useState(initialTag);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const norm = normalizeTag(tag);
    if (!isValidTag(norm)) {
      setError({
        error: "Tags use letters and digits, like #2YPGV0Y9.",
        code: "BAD_TAG",
      });
      return;
    }
    setLoading(true);
    try {
      const endpoint = linkToMyAccount
        ? "/api/me/link-tag"
        : "/api/players/connect";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: norm }),
        credentials: "same-origin",
      });

      // Even on 500 the server sends JSON; if parsing fails the route crashed.
      const data = (await res.json().catch(() => null)) as
        | (ApiError & { player?: { slug: string } })
        | null;

      if (!data) {
        setError({
          error:
            "The dev server returned an unparseable response. Check the terminal where you ran `npm run dev`.",
          code: "BAD_RESPONSE",
        });
        return;
      }
      if (!res.ok || !data.player) {
        setError({ error: data.error, hint: data.hint, code: data.code });
        return;
      }
      router.push(`/dashboard/${data.player.slug}`);
    } catch (err) {
      // True network failure — server didn't respond at all.
      const msg = err instanceof Error ? err.message : String(err);
      setError({
        error: `Couldn't reach the API (${msg}).`,
        hint: "Make sure `npm run dev` is running and the terminal isn't showing a Prisma / database error.",
        code: "NETWORK",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Input
          id="player-tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="#2YPGV0Y9"
          aria-label="Player tag"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          className="sm:flex-1"
        />
        <Button type="submit" size="lg" disabled={loading} aria-busy={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
            </>
          ) : linkToMyAccount ? (
            "Save & continue"
          ) : (
            "Open dashboard"
          )}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-loss/40 bg-loss/10 p-3 text-sm text-loss"
        >
          <div>{error.error}</div>
          {error.hint && (
            <div className="mt-1 text-xs text-loss/80">
              {error.hint.startsWith("http") ? (
                <a
                  href={error.hint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-loss"
                >
                  Open Brawl Stars developer portal ↗
                </a>
              ) : (
                error.hint
              )}
            </div>
          )}
          {["NO_API_KEY", "API_IP_MISMATCH", "FORBIDDEN"].includes(
            error.code ?? "",
          ) && (
            <div className="mt-2 text-xs text-muted-foreground">
              You can also{" "}
              <a href="/demo" className="underline hover:text-foreground">
                preview the dashboard with demo data
              </a>{" "}
              while live data is unavailable.
            </div>
          )}
        </div>
      )}

    </form>
  );
}
