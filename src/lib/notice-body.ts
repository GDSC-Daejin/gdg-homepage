// 공지의 일정·장소·준비물은 body 맨 앞 머리말 줄로 직렬화해 한 칸에 담는다.
// ponytail: notices 테이블에 컬럼을 늘리지 않고 텍스트 왕복으로 끝냄.
// 공지를 장소/일정으로 조회할 일이 생기면 그때 컬럼으로 승격.

export interface NoticeDetails {
  /** DatePicker(withTime) 값 "YYYY-MM-DDTHH:mm" */
  schedule: string;
  /** 장소 이름 (장소 풀에서 고른 값) */
  place: string;
  supplies: string;
  body: string;
}

const SCHEDULE = "🗓 일정";
const PLACE = "📍 장소";
const SUPPLIES = "🎒 준비물";

const HEAD_LINE = new RegExp(`^(${SCHEDULE}|${PLACE}|${SUPPLIES}): *(.*)$`);
const SCHEDULE_VALUE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/;

export function composeNoticeBody(details: NoticeDetails): string {
  const head = [
    details.schedule && `${SCHEDULE}: ${details.schedule.replace("T", " ")}`,
    details.place && `${PLACE}: ${details.place}`,
    details.supplies && `${SUPPLIES}: ${details.supplies}`,
  ].filter(Boolean);

  const body = details.body.trim();
  if (!head.length) return body;
  return body ? `${head.join("\n")}\n\n${body}` : head.join("\n");
}

export function parseNoticeBody(raw: string): NoticeDetails {
  const lines = raw.split("\n");
  const details: NoticeDetails = { schedule: "", place: "", supplies: "", body: "" };

  let i = 0;
  for (; i < lines.length; i++) {
    const match = HEAD_LINE.exec(lines[i].trim());
    if (!match) break;
    const [, label, rawValue] = match;
    const value = rawValue.trim();
    if (label === SCHEDULE) {
      // 손으로 쓴 자유형 일정("매주 화 19:00")은 폼 필드로 못 담으므로 본문에 그대로 남긴다
      if (!SCHEDULE_VALUE.test(value)) break;
      details.schedule = value.replace(" ", "T");
    } else if (label === PLACE) {
      details.place = value;
    } else {
      details.supplies = value;
    }
  }

  details.body = lines.slice(i).join("\n").trim();
  return details;
}
