import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { Place } from "@/lib/types";

/** 장소 풀 (둘러보기 모드에선 빈 배열) */
export async function listPlaces(): Promise<Place[]> {
  if (await isDemoMode()) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("places").select("*").order("name", { ascending: true });
  return (data ?? []) as Place[];
}
