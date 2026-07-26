"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { getCommunity } from "@/lib/community";
import { noticeSchema } from "@/lib/schemas";
import { postSlack } from "@/lib/slack";
import type { ActionResult } from "@/lib/types";

type PublishResult = ActionResult & { slack?: string };

function parseNoticeForm(formData: FormData) {
  return noticeSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
  });
}

export async function createNotice(formData: FormData): Promise<ActionResult> {
  const profile = await requireAdmin();

  const parsed = parseNoticeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const community = await getCommunity();
  const result = await community.notices.ops.create({
    ...parsed.data,
    created_by: profile.id,
  });
  if (result.error) return result;

  revalidatePath("/admin/notices");
  return {};
}

export async function updateNotice(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseNoticeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const community = await getCommunity();
  const result = await community.notices.ops.update(id, parsed.data);
  if (result.error) return result;

  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath(`/notices/${id}`);
  revalidatePath("/notices");
  return {};
}

export async function deleteNotice(id: string): Promise<ActionResult> {
  await requireAdmin();

  const community = await getCommunity();
  const result = await community.notices.ops.delete(id);
  if (result.error) return result;

  revalidatePath("/admin/notices");
  revalidatePath("/notices");
  return {};
}

export async function publishNotice(
  id: string,
  notifySlack = true,
): Promise<PublishResult> {
  await requireAdmin();

  const community = await getCommunity();
  const result = await community.notices.ops.publish(id);
  if (result.error) return { error: result.error };

  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath(`/notices/${id}`);
  revalidatePath("/notices");

  if (!notifySlack) return { slack: "슬랙 전송 없이 발행" };

  // 데모에서는 ops.publish가 notice를 안 돌려주므로(실제 발행 없음) 슬랙 없이 예시 메시지만 반환
  if (!result.notice) return { slack: "슬랙 전송 완료 (예시)" };

  const notice = result.notice;
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

  if (slackResult.error) {
    return { slack: `슬랙 전송 실패: ${slackResult.error}` };
  }
  return { slack: "슬랙 전송 완료" };
}
