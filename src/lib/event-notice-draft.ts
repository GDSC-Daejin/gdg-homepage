import { EVENT_TYPE_LABELS } from "@/lib/event-type";
import type { EventType } from "@/lib/types";

export type EventNoticeDraftInput = {
  type: EventType;
  title: string;
  description: string;
  /** "YYYY-MM-DD" (KST 날짜) */
  eventDate: string | null;
  /** "HH:MM" (KST) */
  startTime: string | null;
  endTime: string | null;
  location: string;
  address: string;
  speaker: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const TBD = "추후 안내";

const COPY: Record<EventType, { headline: string; intro: string; closing: string }> = {
  session: {
    headline: "안내드립니다!",
    intro: "이번 정기세션 일정을 안내드려요.",
    closing: "많은 분들이 함께해 주시면 좋겠어요! 준비할 내용이 있으면 세션 전에 다시 안내드리겠습니다.",
  },
  study: {
    headline: "함께할 분을 모집합니다!",
    intro: "같이 공부하며 성장할 스터디를 소개해요.",
    closing: "관심 있는 분은 편하게 참여해 주세요!",
  },
  mogakco: {
    headline: "같이 모여 코딩해요!",
    intro: "각자 할 일을 들고 모여 조용히 집중하는 모각코예요.",
    closing: "노트북과 오늘 할 일만 챙겨 오세요!",
  },
  party: {
    headline: "초대합니다!",
    intro: "다 함께 즐기는 자리를 준비했어요.",
    closing: "편한 마음으로 오셔서 즐겁게 이야기 나눠요!",
  },
};

/** "10/30(금)". 날짜는 이미 KST 기준 키라 UTC 자정으로 요일만 구한다. */
function dateLabel(dateKey: string): string {
  const [, mo, dy] = dateKey.split("-").map(Number);
  return `${mo}/${dy}(${WEEKDAYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()]})`;
}

/** "16:30" → "오후 4시 30분" */
function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const meridiem = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${meridiem} ${hour12}시${m ? ` ${m}분` : ""}`;
}

function timeRange(start: string | null, end: string | null): string {
  if (!start) return TBD;
  return end ? `${timeLabel(start)} ~ ${timeLabel(end)}` : `${timeLabel(start)}부터`;
}

/** 슬랙이 <!channel> 같은 꺾쇠 구문을 해석하지 못하게 이스케이프하고, 코드 블록을 깨는 ```는 바꾼다. */
function escapeSlack(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```/g, "'''");
}

/**
 * 이벤트 값으로 만든 공지 초안 본문. 일반 텍스트이고 `@channel`은 글자 그대로다.
 * 값이 비면 그 줄을 뺀다. 시기에 맞는 인사말은 운영진이 채울 자리로 남긴다.
 */
export function buildEventNoticeDraft(input: EventNoticeDraftInput): string {
  const copy = COPY[input.type];
  const title = input.title.trim();
  const description = input.description.trim();

  const info = [
    `* 일정: ${input.eventDate ? dateLabel(input.eventDate) : TBD}`,
    `* 시간: ${timeRange(input.startTime, input.endTime)}`,
    input.location.trim() && `* 장소: ${input.location.trim()}`,
    input.address.trim() && `* 위치: ${input.address.trim()}`,
    input.speaker.trim() && `* 발표자: ${input.speaker.trim()}`,
  ].filter(Boolean);

  return [
    `@channel ${title} ${copy.headline}`,
    "[인사말: 시기에 맞게 수정]",
    copy.intro,
    `${EVENT_TYPE_LABELS[input.type]} · ${title}\n\n${info.join("\n")}`,
    description,
    copy.closing,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** 슬랙에 올릴 메시지: 안내 한 줄 + 어드민 링크 + 코드 블록으로 감싼 초안. */
export function buildEventNoticeDraftMessage(
  input: EventNoticeDraftInput,
  adminUrl: string,
): string {
  const title = escapeSlack(input.title.trim()).replace(/\*/g, "");
  const draft = escapeSlack(buildEventNoticeDraft(input));
  return `📝 *${title}* 공지 초안이에요. 아래 내용을 다듬어 공지 채널에 올려 주세요.\n<${adminUrl}|어드민에서 이벤트 보기>\n\`\`\`\n${draft}\n\`\`\``;
}
