# Authentication & API protection

This app uses [Auth.js v5](https://authjs.dev) (`next-auth@beta`) with the **Prisma adapter** — users, OAuth accounts, and database-backed sessions live in SQLite (or Postgres in production).

## OAuth providers

- **Google** — set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (or legacy `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
- **Discord** — optional. Set both `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` to show the Discord button on `/login`.

## Flow

1. Visitor uses **guest connect** (`POST /api/players/connect` from the home page) unchanged — no account required.
2. **Sign in** → OAuth → **`/post-login`** redirects to **`/dashboard/{slug}`** if `User.linkedPlayerTag` is set, otherwise **`/connect-tag`** (`POST /api/me/link-tag` validates the tag like connect, saves `linkedPlayerTag` / `linkedPlayerId`).
3. **Duplicate tag**: if another user already linked that tag → **409** `TAG_TAKEN`.

## What requires a linked session?

| Endpoint / action                         | Guests | Signed-in, wrong tag | Signed-in, linked tag |
| ----------------------------------------- | ------ | ---------------------- | ----------------------- |
| `POST /api/players/connect`               | ✅     | ✅                     | ✅                      |
| `POST /api/me/link-tag`                   | ❌     | N/A                    | ✅                      |
| `POST/PATCH …/settings`                   | ❌¹    | ❌                     | ✅                      |
| `DELETE …/settings`                       | ❌     | ❌                     | ✅                      |
| `POST …/refresh`                          | ✅²    | ❌                     | ✅                      |
| Battle/stats/card **read** APIs           | ✅     | ✅                     | ✅                      |
| `GET …/export`                           | ✅     | ✅                     | ✅                      |

¹ Guests may toggle **ranked logging only** (`startRankedLogging`) when the HTTP-only **guest connect cookie** matches the dashboard slug — same browser rule as manual Capture/refresh. Other `settings` fields (e.g. `trackOnlyRanked`) still require a linked account.

² Guests may **refresh / Capture** when the guest connect cookie matches the slug (`POST …/refresh`). Guests without that cookie cannot refresh.

Destructive **`DELETE`** on settings clears any `User` rows pointing at that player before deleting the `Player`.

## Secrets

See `.env.example` for `AUTH_SECRET`, `AUTH_URL`, and provider keys. **`AUTH_SECRET` is required in production** (e.g. `openssl rand -base64 32`). In local development, if `AUTH_SECRET` and `NEXTAUTH_SECRET` are unset, the app uses a hardcoded dev fallback so pages do not 500 — replace it with a real secret before deploying.
