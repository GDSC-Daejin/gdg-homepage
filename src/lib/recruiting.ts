import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/constants";
import type { RecruitingSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: RecruitingSettings = {
  season: CURRENT_SEASON,
  is_open: false,
  open_positions: ["frontend", "backend", "designer"],
};

export async function getRecruitingSettings(): Promise<RecruitingSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruiting_settings")
    .select("season, is_open, open_positions")
    .eq("id", 1)
    .single();

  if (error || !data) return DEFAULT_SETTINGS;

  return data as RecruitingSettings;
}
