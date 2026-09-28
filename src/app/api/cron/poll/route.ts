import { NextRequest, NextResponse } from "next/server";
import { pollStalePlayers } from "@/lib/poll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel hobby plan limits cron jobs to 5 minutes. Keep this short.
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured? Only allow on localhost — useful for dev.
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function run(req: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.CRON_SECRET?.trim()
  ) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await pollStalePlayers(5 * 60 * 1000);
  return NextResponse.json({
    ok: true,
    scanned: result.scanned,
    inserted: result.results.reduce((s, r) => s + r.inserted, 0),
    errors: result.errors,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
