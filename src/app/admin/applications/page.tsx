import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/constants";
import type { Application } from "@/lib/types";
import { ApplicationsView } from "./ApplicationsView";
import { isDemoMode } from "@/lib/demo";
import { DEMO_APPLICATION_SEASONS, DEMO_APPLICATIONS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const demo = await isDemoMode();

  let seasons: string[] = DEMO_APPLICATION_SEASONS;
  let season = params.season ?? seasons[0] ?? CURRENT_SEASON;
  let seasonApplications: Application[] = DEMO_APPLICATIONS.filter(
    (a) => a.season === season,
  );

  if (!demo) {
    const supabase = await createClient();

    const { data: seasonRows } = await supabase
      .from("applications")
      .select("season")
      .order("season", { ascending: false });
    seasons = Array.from(
      new Set(
        ((seasonRows as { season: string }[] | null) ?? []).map((row) => row.season),
      ),
    );
    season = params.season ?? seasons[0] ?? CURRENT_SEASON;

    const { data: appData } = await supabase
      .from("applications")
      .select("*")
      .eq("season", season)
      .order("created_at", { ascending: false });
    seasonApplications = (appData as Application[] | null) ?? [];
  }

  return (
    <ApplicationsView
      applications={seasonApplications}
      seasons={seasons.length ? seasons : [CURRENT_SEASON]}
      season={season}
    />
  );
}
