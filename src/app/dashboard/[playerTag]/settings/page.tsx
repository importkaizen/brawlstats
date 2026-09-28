import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { loadDashboardPlayerRecord } from "@/lib/dashboardPlayerLoad";
import { tagForUrl } from "@/lib/tag";
import { SettingsClient } from "@/components/dashboard/SettingsClient";
import { canMutateFromSession } from "@/lib/playerMutations";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: { playerTag: string };
}) {
  const player = await loadDashboardPlayerRecord(params.playerTag);
  if (!player) return notFound();

  const session = await auth();
  const canMutate = canMutateFromSession(session, player.tag);

  return (
    <SettingsClient
      initial={{
        tag: player.tag,
        name: player.name,
        slug: tagForUrl(player.tag),
        trackOnlyRanked: player.trackOnlyRanked,
      }}
      canMutate={canMutate}
    />
  );
}
