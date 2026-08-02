import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/constants";
import { recruitingStatus } from "@/lib/recruiting-window";
import type { RecruitingSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: RecruitingSettings = {
  season: CURRENT_SEASON,
  is_open: false,
  open_positions: ["frontend", "backend", "designer"],
  apply_start: null,
  apply_end: null,
};

export async function getRecruitingSettings(): Promise<RecruitingSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruiting_settings")
    .select("season, is_open, open_positions, apply_start, apply_end")
    .eq("id", 1)
    .single();

  if (error || !data) return DEFAULT_SETTINGS;

  return data as RecruitingSettings;
}

/** 실제 지원 접수 중인지: 수동 스위치(is_open) + 오늘이 지원기간 안. 종료일이 지나면 자동 마감. */
export function isRecruitingOpen(s: RecruitingSettings): boolean {
  return recruitingStatus(s.is_open, s.apply_start ?? "", s.apply_end ?? "") === "open";
}
