import { formatKst } from "@/lib/format";
import { postMessage } from "@/lib/slack/api";
import { INQUIRY_CATEGORY_LABEL } from "@/lib/types";
import type { InquiryCategory } from "@/lib/types";

const BODY_LIMIT = 300;

/**
 * 새 문의를 운영진 전용 채널로 알린다.
 *
 * 작성자 이름이 그대로 담기므로 공개 채널에 묶인 SLACK_WEBHOOK_URL은 쓰지 않는다.
 * 출석 경고·회의 확정과 같이 Jarvis(SLACK_JARVIS_BOT_TOKEN) 이름으로만 나간다 — 꼬북봇으로 폴백하지 않는다.
 */
export async function sendInquiryNotification(input: {
  category: InquiryCategory;
  title: string;
  body: string;
  author: string;
  createdAt: string;
}): Promise<{ error?: string }> {
  const channel = process.env.SLACK_ADMIN_CHANNEL_ID;
  if (!channel) return { error: "운영진 슬랙 채널이 설정되지 않았어요 (SLACK_ADMIN_CHANNEL_ID)" };

  const botToken = process.env.SLACK_JARVIS_BOT_TOKEN;
  if (!botToken) return { error: "운영진 봇 토큰이 설정되지 않았어요 (SLACK_JARVIS_BOT_TOKEN)" };

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const body =
    input.body.length > BODY_LIMIT ? `${input.body.slice(0, BODY_LIMIT)}...` : input.body;

  const result = await postMessage({
    channel,
    botToken,
    text: [
      `[문의] 새 문의가 등록됐어요 (${INQUIRY_CATEGORY_LABEL[input.category]})`,
      `*${input.title}*`,
      `${input.author} · ${formatKst(input.createdAt)}`,
      "",
      body,
      "",
      `${siteUrl}/admin/inquiries`,
    ].join("\n"),
  });

  return result.ok ? {} : { error: `슬랙 문의 알림에 실패했어요 (${result.error})` };
}
