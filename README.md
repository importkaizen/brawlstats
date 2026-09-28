# MyreBrawl

Auto-tracking ranked dashboard for **Brawl Stars**. Drop in your player tag and
MyreBrawl fetches every ranked battle, rebuilds your rating curve, and surfaces
the brawlers and maps you actually win on.

Built with Next.js (App Router), TypeScript, Tailwind CSS, Prisma + PostgreSQL,
Recharts and `@vercel/og` for shareable cards.

## Features

- Connect-by-tag onboarding — no accounts, no passwords.
- Background polling every 15 minutes (GitHub Actions) with deduplication.
- Saved battle history with pages for older games; captured records are never
  pruned when the API's recent battle window changes.
- Rating curve with rank thresholds (Bronze → Pro) overlaid.
- Per-brawler win rate, average rating change, and game volume.
- Per-map / per-mode breakdown with sortable filters.
- Season filtering (current / previous / all-time) derived deterministically.
- Settings page: re-link tag, toggle ranked-only tracking, CSV export, full delete.
- Shareable OG image cards at `/card/[tag]`.

## Quick start

```bash
npm install
npm run db:push:local    # creates ./prisma/dev.db (SQLite)
npm run dev              # http://localhost:3000
```


To wire up live data, drop an API key into `.env`:

```bash
# .env
BRAWLSTARS_API_KEY=your-key-from-developer.brawlstars.com
```

Get one at <https://developer.brawlstars.com>. The key is bound to the
IP it was created with, so whitelist your egress IP. Once that's in,
the connect form on `/` will fetch your real battle history.

### Postgres for production

`prisma/schema.prisma` is the production PostgreSQL schema. Local development
uses `prisma/schema.sqlite.prisma`; `npm run dev` generates its local client.
Set `DATABASE_URL` to your hosted PostgreSQL connection string. The Vercel
build applies the schema automatically before the app is built. You can also
run `npm run db:push` once against the production database yourself.

The `raw` battle-payload column is stored as a JSON-serialized string so
the schema works against either provider unchanged.

## Environment variables

| Var                     | Required | Description |
| ----------------------- | -------- | ----------- |
| `DATABASE_URL`          | Yes      | Postgres connection string. |
| `BRAWLSTARS_API_KEY`    | Prod     | Bearer token from <https://developer.brawlstars.com>. IP-locked. |
| `BRAWLSTARS_API_KEY_BACKUP` | Optional | Second token, tried after a key rejection (401/403). The last successful key is reused. |
| `BRAWLSTARS_PROXY_URL`  | Optional | Override the API base URL with a fixed-IP proxy you control. |
| `CRON_SECRET`           | Prod     | Token GitHub Actions sends as `Authorization: Bearer …`. |
| `NEXT_PUBLIC_APP_URL`   | Optional | Public site URL — used for OG metadata. |

## Saved match history

- Each capture inserts new battles into the database and leaves existing
  battles intact. An empty API response, a shorter recent window, a new
  season, or resetting the Ranked session does not delete saved battles.
- Ranked battles are archived even before starting a Ranked chart session.
  The ranked-only tracking preference still controls which queues are captured.
- Profile and Ranked pages capture every minute while open and visible for
  an authorized player. The configured server cron continues capture when
  deployed and running. Games must be captured before they leave the API's
  recent window; history that the API no longer returns cannot be recovered.
- The Profile's Saved match history shows 25 battles per page, with Older
  games / Newer games navigation across the entire archive.
- Local history is stored in `prisma/dev.db` across restarts. Keep this file
  when moving or backing up the app. Production needs a persistent database.
  The explicit Delete player action also deletes that player's history.

## Architecture

```
Brawl Stars API ─┐
                 ├─► /lib/poll.pollPlayer ─► Prisma (Postgres) ─► /api/* ─► UI
GitHub Actions ──┘                                            └─► /card/* (OG)
```

- `src/lib/brawlstars.ts` — typed API client for the official Brawl Stars
  API at `api.brawlstars.com/v1`. Requires a `BRAWLSTARS_API_KEY` (the
  player and battlelog endpoints have no public proxy).
- `src/lib/poll.ts` — fetches `players/{tag}` + `battlelog`, dedupes via the
  `(playerId, battleTime)` unique constraint, persists the API's
  authoritative `rankedElo` / `rankedRankName` snapshot, and stamps the
  current `rankedElo` onto every newly-discovered ranked battle. The
  Brawl Stars API does not expose per-battle elo deltas for `soloRanked`
  / `teamRanked` matches (only for the trophy ladder), so we capture
  the absolute snapshot at insertion time instead.
- `src/lib/brawlstars.ts` — note: `battle.type === "ranked"` in the API
  is the *trophy* ladder. The actual Ranked queue is
  `soloRanked` / `teamRanked`. `isRankedBattle` filters accordingly.
- `src/lib/rankedStats.ts` — ranked-specific aggregation (record, streak,
  recent form, star-player %, peak) feeding the `/dashboard/[tag]/ranked`
  view.
- `src/lib/stats.ts` — pure aggregation helpers (summary, brawler stats, map
  stats, rating history) so they can be reused in API routes and the OG card.
- `src/lib/seasons.ts` — deterministic season IDs based on a fortnightly
  cadence anchored on the post-rework Season 1 start.
- `src/app/api/cron/poll/route.ts` — scans players whose `lastPolled` is
  older than 15 minutes and re-polls them. Authorized via `CRON_SECRET`.

## Deployment

1. Push a Postgres database (Supabase, Neon, Railway are all fine) and copy
   the URL into `DATABASE_URL`.
2. Get an API key at <https://developer.brawlstars.com>. Whitelist your egress
   IP. **Vercel Functions have dynamic IPs** — for production, route the
   Brawl Stars API through a small fixed-IP proxy (a $5 VPS works) and set
   `BRAWLSTARS_PROXY_URL`.
3. Set `CRON_SECRET` to a long random string in Vercel. In GitHub, add the
   same value as the `CRON_SECRET` Actions secret and add the deployment URL
   as the `PUBLIC_APP_URL` Actions variable. The included workflow calls
   `/api/cron/poll` every 15 minutes.
4. Deploy. The first poll will populate every connected player.
