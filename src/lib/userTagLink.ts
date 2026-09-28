import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";

/**
 * If another user already linked this tag, they must sign in as that user.
 */
export async function findUserIdBlockingTagLink(
  prisma: PrismaClient,
  tag: string,
  exceptUserId: string,
) {
  return prisma.user.findFirst({
    where: {
      linkedPlayerTag: tag,
      NOT: { id: exceptUserId },
    },
    select: { id: true },
  });
}

export function duplicateTagResponse() {
  return NextResponse.json(
    {
      error:
        "That Brawl Stars tag is already linked to another account. Sign in with that account or use a different tag.",
      code: "TAG_TAKEN",
    },
    { status: 409 },
  );
}
