import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { tagFromUrl } from "@/lib/tag";

/**
 * Single Prisma query per dashboard navigation; React `cache()` dedupes when
 * multiple modules read the same player in one render pass.
 */
export const loadDashboardPlayerRecord = cache(async (encodedSlug: string) => {
  const tag = tagFromUrl(encodedSlug);
  return prisma.player.findUnique({ where: { tag } });
});

export const loadDashboardPlayerWithBattlesDesc = cache(
  async (encodedSlug: string) => {
    const tag = tagFromUrl(encodedSlug);
    return prisma.player.findUnique({
      where: { tag },
      include: {
        battles: { orderBy: { battleTime: "desc" } },
      },
    });
  },
);

export type DashboardPlayerWithBattlesDesc = NonNullable<
  Awaited<ReturnType<typeof loadDashboardPlayerWithBattlesDesc>>
>;
