import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";
import { brawlerStats, filterBySeason, summarize } from "@/lib/stats";
import { getSubTier } from "@/lib/rankedTiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { playerTag: string } },
) {
  const tag = tagFromUrl(params.playerTag);
  const player = await prisma.player.findUnique({
    where: { tag },
    include: { battles: true },
  });

  if (!player) {
    return new Response("Player not found", { status: 404 });
  }

  const battles = filterBySeason(player.battles, "current");
  const summary = summarize(battles);
  const top = brawlerStats(battles, { playerTag: tag })
    .filter((b) => b.games >= 2)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3);

  // Prefer the API's authoritative current ranked elo (matches in-game).
  const rating = player.rankedElo ?? summary.currentRating ?? player.trophies;
  const rank = getSubTier(rating);
  const winRate = summary.totalGames === 0 ? 0 : summary.winRate;
  // Show career-high on the card; trophy-game noise should never push
  // it down on a shareable artifact.
  const peak =
    player.peakAllTimeRankedElo ??
    summary.peakRating ??
    player.highestTrophies;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          padding: "56px",
          background:
            "linear-gradient(135deg, #0B1220 0%, #1A1037 60%, #2B0B33 100%)",
          color: "#F8FAFC",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#FFD700",
                color: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              ⚡
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>
              Myre<span style={{ color: "#FFD700" }}>Brawl</span>
            </div>
          </div>
          <div
            style={{
              fontSize: 22,
              padding: "8px 18px",
              borderRadius: 999,
              border: `2px solid ${rank.color}`,
              color: rank.color,
              background: `${rank.color}22`,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: rank.color,
                display: "block",
              }}
            />
            {rank.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
          <div style={{ fontSize: 22, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2 }}>
            {player.tag}
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1,
              marginTop: 8,
            }}
          >
            {player.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 40,
          }}
        >
          <Tile
            label="Current Rank Rating"
            value={rating.toLocaleString()}
            accent="#FFD700"
          />
          <Tile
            label="Win rate"
            value={summary.totalGames === 0 ? "—" : `${(winRate * 100).toFixed(0)}%`}
            accent={winRate >= 0.5 ? "#22C55E" : "#EF4444"}
          />
          <Tile label="Games" value={summary.totalGames.toString()} accent="#A78BFA" />
          <Tile
            label="All-Time Rank Peak"
            value={peak.toLocaleString()}
            accent="#22D3EE"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ fontSize: 18, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2 }}>
            Top brawlers this season
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
            {top.length === 0 && (
              <div style={{ color: "#64748B", fontSize: 22 }}>
                Not enough games yet — go grind some!
              </div>
            )}
            {top.map((b) => (
              <div
                key={b.brawlerId}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 22px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minWidth: 200,
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 700 }}>{b.brawlerName}</div>
                <div style={{ display: "flex", gap: 16, marginTop: 6, color: "#CBD5E1", fontSize: 18 }}>
                  <span>{b.games} games</span>
                  <span style={{ color: "#FFD700" }}>{(b.winRate * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: 24,
        borderRadius: 20,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${accent}55`,
      }}
    >
      <div style={{ color: "#94A3B8", fontSize: 16, textTransform: "uppercase", letterSpacing: 2 }}>
        {label}
      </div>
      <div
        style={{
          color: accent,
          fontSize: 56,
          fontWeight: 900,
          marginTop: 6,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
