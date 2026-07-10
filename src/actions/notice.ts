"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { noticeSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { postSlack } from "@/lib/slack";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult, Notice } from "@/lib/types";

type PublishResult = ActionResult & { slack?: string };

function parseNoticeForm(formData: FormData) {
  return noticeSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
  });
}

export async function createNotice(formData: FormData): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = parseNoticeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notices")
    .insert({ ...parsed.data, created_by: profile.id });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/notices");
  return {};
}

export async function updateNotice(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = parseNoticeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notices")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath(`/notices/${id}`);
  revalidatePath("/notices");
  return {};
}

export async function deleteNotice(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("notices").delete().eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/notices");
  revalidatePath("/notices");
  return {};
}

export async function publishNotice(id: string): Promise<PublishResult> {
  await requireAdmin();
  if (await isDemoMode()) return { slack: "슬랙 전송 완료 (예시)" };

  const supabase = await createClient();
  const { data, error: fetchError } = await supabase
    .from("notices")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) return { error: toKoreanError(fetchError) };

  const { error } = await supabase.rpc("admin_publish_notice", {
    p_notice: id,
  });

  if (error) return { error: toKoreanError(error) };

  const notice = data as Notice;
  const summary =
    notice.body.length > 100 ? `${notice.body.slice(0, 100)}...` : notice.body;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const text = `[공지] ${notice.title}\n${summary}\n${siteUrl}/notices/${notice.id}`;

  const slackResult = await postSlack(text);

  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath(`/notices/${id}`);
  revalidatePath("/notices");

  if (slackResult.error) {
    return { slack: `슬랙 전송 실패: ${slackResult.error}` };
  }
  return { slack: "슬랙 전송 완료" };
}
