import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { DEMO_NOTICE_TEMPLATES } from "@/lib/demoData";
import type { NoticeTemplate } from "@/lib/types";

/** 공지 템플릿, 최근 저장한 순 */
export async function listNoticeTemplates(): Promise<NoticeTemplate[]> {
  if (await isDemoMode()) return DEMO_NOTICE_TEMPLATES;

  const supabase = await createClient();
  const { data } = await supabase
    .from("notice_templates")
    .select("id, name, title, body, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as NoticeTemplate[];
}
