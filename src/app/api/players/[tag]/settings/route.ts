import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";
import {
  GUEST_REFRESH_TAG_COOKIE,
  guestCookieMatchesDashboardSlug,
} from "@/lib/guestRefreshCookie";
import { assertLinkedOwnerForRouteTag } from "@/lib/playerMutations";
import { fetchPlayer } from "@/lib/brawlstars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  trackOnlyRanked: z.boolean().optional(),
  // Set to `true` to record "now" as the moment ranked logging begins
  // (the dashboard surfaces it in the "Logging ranked since…" badge).
  // Set to `false` to clear ranked logging (same as “Reset logging session” on the Ranked tab).
  startRankedLogging: z.boolean().optional(),
});

async function handleSettingsUpdate(
  req: NextRequest,
  params: { tag: string },
): Promise<NextResponse> {
  try {
    const gate = await assertLinkedOwnerForRouteTag(params.tag);
    let guestCookieAuthorized = false;
    if (!gate.ok) {
      const session = await auth();
      if (session?.user?.id) return gate.response;
      const cookieRaw = req.cookies.get(GUEST_REFRESH_TAG_COOKIE)?.value;
      if (!guestCookieMatchesDashboardSlug(cookieRaw, params.tag)) {
        return gate.response;
      }
      guestCookieAuthorized = true;
    }

    const tag = tagFromUrl(params.tag);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    if (guestCookieAuthorized) {
      if (parsed.data.trackOnlyRanked != null) {
        return NextResponse.json(
          {
            error:
              "Sign in and link your tag to change trophy-only tracking.",
          },
          { status: 403 },
        );
      }
      if (parsed.data.startRankedLogging === undefined) {
        return NextResponse.json(
          { error: "No valid fields to update." },
          { status: 400 },
        );
      }
    }

    const player = await prisma.player.findUnique({ where: { tag } });
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    let loggingBaseline: { rankedBaseline: number; rankedBaselineAt: Date } | null =
      null;
    if (parsed.data.startRankedLogging === true && player.rankedBaseline == null) {
      let elo = player.rankedElo ?? null;
      if (elo == null) {
        try {
          const api = await fetchPlayer(player.tag);
          elo = api.rankedElo ?? null;
        } catch {
          // Network / API key issues — DB copy may still have a recent elo.
        }
      }
      if (elo != null) {
        loggingBaseline = { rankedBaseline: elo, rankedBaselineAt: new Date() };
      }
    }

    const updateData: {
      trackOnlyRanked?: boolean;
      rankedLoggingStartedAt?: Date | null;
      rankedBaseline?: number | null;
      rankedBaselineAt?: Date | null;
    } = {
      ...(parsed.data.trackOnlyRanked != null
        ? { trackOnlyRanked: parsed.data.trackOnlyRanked }
        : {}),
      ...(parsed.data.startRankedLogging === true
        ? {
            rankedLoggingStartedAt: player.rankedLoggingStartedAt ?? new Date(),
            ...(loggingBaseline != null ? loggingBaseline : {}),
          }
        : parsed.data.startRankedLogging === false
          ? {
              rankedLoggingStartedAt: null,
              rankedBaseline: null,
              rankedBaselineAt: null,
            }
          : {}),
    };

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.player.update({
      where: { id: player.id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      player: {
        tag: updated.tag,
        trackOnlyRanked: updated.trackOnlyRanked,
        rankedLoggingStartedAt:
          updated.rankedLoggingStartedAt?.toISOString() ?? null,
        rankedBaseline: updated.rankedBaseline,
        rankedBaselineAt: updated.rankedBaselineAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error("settings update", err);
    if (err instanceof Prisma.PrismaClientValidationError) {
      const hint =
        typeof err.message === "string" &&
        err.message.includes("rankedLoggingStartedAt")
          ? " Run `npx prisma generate` (and `npx prisma db push` if the column is missing), then restart the server."
          : "";
      return NextResponse.json(
        {
          error: `Database schema mismatch.${hint}`,
          detail:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not update settings",
      },
      { status: 500 },
    );
  }
}

/** Primary mutation used by the dashboard (POST avoids PATCH being blocked by some proxies). */
export async function POST(
  req: NextRequest,
  ctx: { params: { tag: string } },
) {
  return handleSettingsUpdate(req, ctx.params);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { tag: string } },
) {
  return handleSettingsUpdate(req, ctx.params);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const gate = await assertLinkedOwnerForRouteTag(params.tag);
  if (!gate.ok) return gate.response;

  const tag = tagFromUrl(params.tag);
  const player = await prisma.player.findUnique({ where: { tag } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  await prisma.user.updateMany({
    where: { linkedPlayerId: player.id },
    data: { linkedPlayerId: null, linkedPlayerTag: null },
  });
  await prisma.player.delete({ where: { id: player.id } });
  return NextResponse.json({ ok: true });
}
