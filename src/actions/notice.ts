"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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

  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!siteUrl) {
    // env 미설정 시 요청 헤더에서 origin 복구 (슬랙 링크에 상대경로가 들어가는 것 방지)
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) siteUrl = `${proto}://${host}`;
  }
  const url = `${siteUrl}/notices/${notice.id}`;
  const text = [
    "📢 *새 공지가 등록됐어요*",
    "",
    `*제목*\n${notice.title}`,
    "",
    `*본문*\n${summary}`,
    "",
    `*링크*\n${url}`,
  ].join("\n");

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
