import { NextResponse } from "next/server";
import { BrawlApiError, MissingApiKeyError } from "@/lib/brawlstars";

type ErrorBody = {
  error: string;
  hint?: string;
  code?: string;
};

export function connectFail(status: number, body: ErrorBody) {
  return NextResponse.json(body, { status });
}

export function connectErrorResponse(err: unknown, tag: string): NextResponse {
  if (err instanceof MissingApiKeyError) {
    return connectFail(503, {
      error: err.message,
      code: "NO_API_KEY",
      hint: "https://developer.brawlstars.com",
    });
  }

  if (err instanceof BrawlApiError) {
    if (err.status === 0) {
      return connectFail(502, {
        error: err.message,
        code: "NETWORK_ERROR",
        hint:
          "Check your internet connection or BRAWLSTARS_PROXY_URL setting.",
      });
    }
    if (err.status === 403 && err.reason === "accessDenied.invalidIp") {
      const ip = err.message.match(/from IP\s+([\da-f:.]+)/i)?.[1];
      return connectFail(502, {
        error: ip
          ? `The configured Brawl Stars API keys do not allow this server's current IP (${ip}). Create a key allowing that IP, update BRAWLSTARS_API_KEY or BRAWLSTARS_API_KEY_BACKUP, then restart the app.`
          : "The configured Brawl Stars API keys do not allow this server's current IP. Create a key for the server's public IP, update BRAWLSTARS_API_KEY or BRAWLSTARS_API_KEY_BACKUP, then restart the app.",
        code: "API_IP_MISMATCH",
        hint: "https://developer.brawlstars.com",
      });
    }
    if (err.status === 401 || err.status === 403) {
      return connectFail(502, {
        error:
          "Brawl Stars rejected this server's API key. Check that the key is valid and has access to the Brawl Stars API.",
        code: "FORBIDDEN",
        hint: "https://developer.brawlstars.com",
      });
    }
    if (err.status === 404) {
      return connectFail(404, {
        error: `No Brawl Stars player found for tag ${tag}.`,
        code: "PLAYER_NOT_FOUND",
      });
    }
    if (err.status === 429) {
      return connectFail(429, {
        error: "Brawl Stars API rate limit hit. Try again in a minute.",
        code: "RATE_LIMITED",
      });
    }
    return connectFail(502, {
      error: `Brawl Stars API error: ${err.message}`,
      code: "API_ERROR",
    });
  }

  const message = err instanceof Error ? err.message : String(err);
  if (
    /Environment variable not found.*DATABASE_URL/i.test(message) ||
    /database.*does not exist/i.test(message) ||
    /Can'?t reach database server/i.test(message) ||
    /ECONNREFUSED/i.test(message) ||
    /ENOENT/i.test(message)
  ) {
    return connectFail(500, {
      error:
        "The database isn't set up yet. Run `npm run db:push` to initialise it (it'll create a SQLite file at ./prisma/dev.db).",
      code: "DB_NOT_READY",
    });
  }

  console.error("[connect/player] unhandled error", err);
  return connectFail(500, {
    error: `Server error: ${message}`,
    code: "SERVER_ERROR",
  });
}
