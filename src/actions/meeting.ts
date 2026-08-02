"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import { fetchPublishedMeetings } from "@/lib/notion";

export async function syncMeetingsFromNotion(): Promise<{
  error?: string;
  synced?: number;
  removed?: number;
}> {
  await requireAdmin();
  if (await isDemoMode()) return { synced: 0, removed: 0 };

  const { meetings, error } = await fetchPublishedMeetings();
  if (error) return { error };

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (meetings.length > 0) {
    const rows = meetings.map((m) => ({ ...m, synced_at: now }));
    const { error: upsertError } = await supabase
      .from("meetings")
      .upsert(rows, { onConflict: "notion_page_id" });
    if (upsertError) return { error: toKoreanError(upsertError) };
  }

  // 노션에서 공개 해제된 회의는 미러에서 제거
  const { data: existing } = await supabase.from("meetings").select("notion_page_id");
  const keep = new Set(meetings.map((m) => m.notion_page_id));
  const toRemove = (existing ?? [])
    .map((r) => r.notion_page_id as string)
    .filter((id) => !keep.has(id));

  let removed = 0;
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("meetings")
      .delete()
      .in("notion_page_id", toRemove);
    if (deleteError) return { error: toKoreanError(deleteError) };
    removed = toRemove.length;
  }

  revalidatePath("/meetings");
  revalidatePath("/admin");
  return { synced: meetings.length, removed };
}
