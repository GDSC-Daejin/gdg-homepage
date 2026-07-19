import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/constants";
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

/** 오늘(KST) "YYYY-MM-DD" */
function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 실제 지원 접수 중인지: 수동 스위치(is_open) + 오늘이 지원기간 안. 종료일이 지나면 자동 마감. */
export function isRecruitingOpen(s: RecruitingSettings): boolean {
  if (!s.is_open) return false;
  const today = kstToday();
  if (s.apply_start && today < s.apply_start) return false;
  if (s.apply_end && today > s.apply_end) return false;
  return true;
}
