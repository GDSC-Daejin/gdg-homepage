import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  aggregate,
  avatarColor,
  avatarInitial,
  AVATAR_COLORS,
  dateRange,
  dateWithWeekday,
  durationLabel,
  HEAT_STEPS,
  heatStep,
  MAX_POLL_DAYS,
  MIN_BLOCK_MIN,
  normalizeSlots,
  pollSlotSet,
  pollTimes,
  recommendBlocks,
  rectSlots,
  slotEndIso,
  slotIso,
  suggestPollTitle,
  timeAmPm,
  toViews,
  weekdayColor,
  type Participant,
} from "@/lib/meeting-poll";

const DATES = ["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];
const TIMES = pollTimes(18, 24, 30);

/** 원본 목업의 AVAIL을 그대로 옮긴 응답 (day index → slot index 목록) */
function participant(id: string, name: string, avail: Record<number, number[]>): Participant {
  const slots: string[] = [];
  for (const [day, list] of Object.entries(avail)) {
    for (const slot of list) slots.push(slotIso(DATES[Number(day)], TIMES[slot]));
  }
  return {
    id,
    user_id: null,
    name,
    email: null,
    slots,
    responded_at: "2026-07-30T00:00:00.000Z",
  };
}

const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe("pollTimes", () => {
  it("30분 단위로 종료 시간 직전까지 만든다", () => {
    expect(pollTimes(18, 20, 30)).toEqual(["18:00", "18:30", "19:00", "19:30"]);
  });

  it("1시간 단위면 정시만 만든다", () => {
    expect(pollTimes(18, 22, 60)).toEqual(["18:00", "19:00", "20:00", "21:00"]);
  });

  it("하루 종일(0~24시) 30분이면 48칸", () => {
    expect(pollTimes(0, 24, 30)).toHaveLength(48);
  });

  it("자정 종료는 23:30까지 담는다", () => {
    expect(pollTimes(22, 24, 30)).toEqual(["22:00", "22:30", "23:00", "23:30"]);
  });
});

describe("dateRange", () => {
  it("양끝을 모두 포함한다", () => {
    expect(dateRange("2026-08-03", "2026-08-05")).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
  });

  it("달·해 경계를 넘어간다", () => {
    expect(dateRange("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("상한을 넘는 범위는 끊는다", () => {
    expect(dateRange("2026-01-01", "2026-12-31").length).toBeLessThanOrEqual(
      MAX_POLL_DAYS + 1,
    );
  });
});

describe("slotIso", () => {
  it("KST 시각을 UTC ISO로 바꾼다 (서머타임 없음)", () => {
    expect(slotIso("2026-08-03", "19:00")).toBe("2026-08-03T10:00:00.000Z");
  });

  it("자정 근처 칸이 전날 UTC로 넘어간다", () => {
    expect(slotIso("2026-08-03", "00:30")).toBe("2026-08-02T15:30:00.000Z");
  });
});

describe("normalizeSlots", () => {
  it("Postgres timestamptz 표기를 slotIso와 같은 문자열로 통일한다", () => {
    expect(normalizeSlots(["2026-08-03 10:00:00+00"])).toEqual([
      slotIso("2026-08-03", "19:00"),
    ]);
  });
});

describe("avatarInitial", () => {
  it("괄호가 있으면 괄호 안 성을 쓴다 — 원본은 Jayden(옥지훈)을 '옥'으로 보여준다", () => {
    expect(avatarInitial("Jayden(옥지훈)")).toBe("옥");
    expect(avatarInitial("캐서린(김서연)")).toBe("김");
  });

  it("괄호가 없으면 첫 글자", () => {
    expect(avatarInitial("홍준표")).toBe("홍");
    expect(avatarInitial("")).toBe("?");
  });
});

describe("avatarColor", () => {
  it("같은 이름은 항상 같은 색", () => {
    expect(avatarColor("Nova(정예원)")).toBe(avatarColor("Nova(정예원)"));
  });

  it("팔레트 안의 색만 쓴다", () => {
    for (const name of ["가", "나", "다", "Jayden(옥지훈)", "June(홍준표)"]) {
      expect(AVATAR_COLORS).toContain(avatarColor(name));
    }
  });
});

describe("heatStep", () => {
  it("응답자 6명이면 인원수가 그대로 단계가 된다 — 원본 히트맵과 같은 색", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => heatStep(n, 6))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("응답자가 많아도 7단계 안에 눌러 담는다", () => {
    expect(heatStep(0, 20)).toBe(0);
    expect(heatStep(20, 20)).toBe(6);
    expect(heatStep(1, 20)).toBeGreaterThanOrEqual(1);
    expect(heatStep(1, 20)).toBeLessThanOrEqual(6);
  });

  it("단계는 HEAT_STEPS 색인 범위를 넘지 않는다", () => {
    for (let total = 1; total <= 12; total++) {
      for (let n = 0; n <= total; n++) {
        expect(HEAT_STEPS[heatStep(n, total)]).toBeDefined();
      }
    }
  });

  it("응답자가 0명이면 나눗셈을 하지 않는다", () => {
    expect(heatStep(0, 0)).toBe(0);
  });
});

describe("aggregate", () => {
  it("응답한 사람만 센다 — 미응답자는 히트맵에 안 들어간다", () => {
    const slot = slotIso(DATES[0], TIMES[0]);
    const views = toViews([
      participant("a", "가", { 0: [0] }),
      { ...participant("b", "나", { 0: [0] }), responded_at: null },
    ]);
    expect(aggregate(views).get(slot)?.map((v) => v.id)).toEqual(["a"]);
  });
});

describe("rectSlots", () => {
  it("두 칸이 만드는 사각 영역을 모두 담는다", () => {
    const slots = rectSlots(
      DATES,
      TIMES,
      { dateIndex: 0, timeIndex: 0 },
      { dateIndex: 1, timeIndex: 1 },
    );
    expect(slots).toHaveLength(4);
    expect(slots).toContain(slotIso(DATES[0], TIMES[0]));
    expect(slots).toContain(slotIso(DATES[1], TIMES[1]));
  });

  it("거꾸로 끌어도 같은 영역이 나온다", () => {
    const forward = rectSlots(DATES, TIMES, { dateIndex: 0, timeIndex: 0 }, { dateIndex: 2, timeIndex: 2 });
    const backward = rectSlots(DATES, TIMES, { dateIndex: 2, timeIndex: 2 }, { dateIndex: 0, timeIndex: 0 });
    expect(new Set(backward)).toEqual(new Set(forward));
  });

  it("격자 밖 좌표는 버린다", () => {
    expect(
      rectSlots(DATES, TIMES, { dateIndex: 0, timeIndex: 0 }, { dateIndex: 99, timeIndex: 99 }).length,
    ).toBe(DATES.length * TIMES.length);
  });
});

describe("pollSlotSet", () => {
  it("격자 칸 전체를 담는다 (4일 × 12칸)", () => {
    const set = pollSlotSet({ dates: DATES, start_hour: 18, end_hour: 24, slot_min: 30 });
    expect(set.size).toBe(48);
    expect(set.has(slotIso(DATES[3], "23:30"))).toBe(true);
  });

  it("범위 밖 시각은 담지 않는다 — 응답 검증의 근거", () => {
    const set = pollSlotSet({ dates: DATES, start_hour: 18, end_hour: 24, slot_min: 30 });
    expect(set.has(slotIso(DATES[0], "17:30"))).toBe(false);
    expect(set.has(slotIso("2026-08-09", "19:00"))).toBe(false);
  });
});

describe("recommendBlocks", () => {
  // 원본 목업의 응답 데이터. 날짜 index는 목업과 같게 0=7/30 … 3=8/2.
  const people = [
    participant("jayden", "Jayden(옥지훈)", { 1: range(6, 8), 2: range(2, 5), 3: range(2, 4) }),
    participant("kate", "캐서린(김서연)", { 0: range(8, 11), 1: range(6, 9), 2: range(2, 7), 3: range(2, 5) }),
    participant("aqua", "Aqua(이우민)", { 1: range(6, 9), 2: range(0, 6), 3: range(2, 5) }),
    participant("nova", "Nova(정예원)", { 2: range(3, 6), 3: range(2, 6) }),
    participant("donny", "Donny(조현돈)", { 1: range(5, 9), 2: range(2, 6) }),
    participant("claire", "Claire(하채윤)", { 1: range(6, 10), 2: range(3, 7), 3: range(1, 4) }),
  ];
  const views = toViews(people);

  it("최대 3개, 순위가 1·2·3으로 붙는다", () => {
    const blocks = recommendBlocks(DATES, TIMES, views, 30);
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.rank)).toEqual([1, 2, 3]);
  });

  it("1순위는 응답자 전원이 비어 있는 8/1 구간이다 — 원본 카드와 같은 결론", () => {
    const [first] = recommendBlocks(DATES, TIMES, views, 30);
    expect(DATES[first.dateIndex]).toBe("2026-08-01");
    expect(first.available).toHaveLength(6);
    expect(first.missing).toHaveLength(0);
  });

  it("구간 길이는 최소 60분을 채운다", () => {
    for (const block of recommendBlocks(DATES, TIMES, views, 30)) {
      expect(block.durationMin).toBeGreaterThanOrEqual(MIN_BLOCK_MIN);
      expect(block.to - block.from + 1).toBe(2);
    }
  });

  it("1시간 단위면 한 칸(60분)으로 구간을 잡는다", () => {
    const hourTimes = pollTimes(18, 24, 60);
    const hourViews = toViews([
      {
        ...participant("a", "가", {}),
        slots: [slotIso(DATES[0], "19:00"), slotIso(DATES[0], "20:00")],
      },
    ]);
    const [block] = recommendBlocks(DATES, hourTimes, hourViews, 60);
    expect(block.durationMin).toBe(60);
    expect(block.to - block.from + 1).toBe(1);
  });

  it("겹치는 구간은 하나만 남는다", () => {
    const blocks = recommendBlocks(DATES, TIMES, views, 30);
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];
        if (a.dateIndex !== b.dateIndex) continue;
        expect(a.to < b.from || b.to < a.from).toBe(true);
      }
    }
  });

  it("응답이 없으면 추천도 없다", () => {
    expect(recommendBlocks(DATES, TIMES, [], 30)).toEqual([]);
  });

  it("격자가 최소 길이보다 짧으면 추천하지 않는다", () => {
    // 30분 단위 격자에 칸이 하나뿐이면 최소 1시간을 못 채운다.
    expect(recommendBlocks(DATES, ["18:00"], views, 30)).toEqual([]);
  });

  it("미응답자는 분모에서 빠진다", () => {
    const withPending = toViews([...people, { ...participant("june", "June(홍준표)", {}), responded_at: null }]);
    const [first] = recommendBlocks(DATES, TIMES, withPending, 30);
    expect(first.available.length + first.missing.length).toBe(6);
  });
});

describe("timeAmPm", () => {
  it("오후·오전·자정을 원본 규칙대로 쓴다", () => {
    expect(timeAmPm("18:00")).toBe("오후 6:00");
    expect(timeAmPm("19:30")).toBe("오후 7:30");
    expect(timeAmPm("24:00")).toBe("자정");
    expect(timeAmPm("00:00")).toBe("자정");
    expect(timeAmPm("09:30")).toBe("오전 9:30");
    expect(timeAmPm("12:00")).toBe("오후 12:00");
  });
});

describe("durationLabel", () => {
  it("90분은 '1시간 30분'", () => {
    expect(durationLabel(30)).toBe("30분");
    expect(durationLabel(60)).toBe("1시간");
    expect(durationLabel(90)).toBe("1시간 30분");
    expect(durationLabel(120)).toBe("2시간");
  });
});

describe("dateWithWeekday · weekdayColor", () => {
  it("'8월 1일 (토)' 꼴로 쓴다", () => {
    expect(dateWithWeekday("2026-08-01")).toBe("8월 1일 (토)");
  });

  it("토요일은 파랑, 일요일은 빨강, 나머지는 기본색", () => {
    expect(weekdayColor("2026-08-01")).toBe("var(--wds-accent-blue)");
    expect(weekdayColor("2026-08-02")).toBe("var(--wds-accent-red)");
    expect(weekdayColor("2026-08-03")).toBe("var(--wds-label-normal)");
  });
});

describe("suggestPollTitle", () => {
  it("한 달 안의 한 주는 '몇째 주'로 짓는다", () => {
    expect(suggestPollTitle("2026-08-03", "2026-08-09")).toBe("8월 첫째 주 모지숲 회의");
  });

  it("달을 걸치면 날짜 범위로 짓는다", () => {
    expect(suggestPollTitle("2026-07-30", "2026-08-05")).toBe("7/30~8/5 모지숲 회의");
  });

  it("날짜가 덜 채워졌거나 거꾸로면 빈 문자열", () => {
    expect(suggestPollTitle("", "2026-08-05")).toBe("");
    expect(suggestPollTitle("2026-08-09", "2026-08-03")).toBe("");
  });
});

describe("slotEndIso", () => {
  it("소요시간을 더한 종료 시각을 돌려준다", () => {
    expect(slotEndIso(slotIso("2026-08-03", "19:00"), 90)).toBe("2026-08-03T11:30:00.000Z");
  });
});

describe("meeting_polls 마이그레이션", () => {
  it("0055: 테이블·잠금·RLS를 정의한다", async () => {
    const sql = await readFile("supabase/migrations/0055_meeting_polls.sql", "utf8");
    expect(sql).toContain("create table public.meeting_polls");
    expect(sql).toContain("function public.is_organizer()");
    expect(sql).toContain('"meeting_polls: owner update"');
  });

  it("0056: 참여자·초대 토큰·마감·단위·익명 RPC를 정의한다", async () => {
    const sql = await readFile(
      "supabase/migrations/0056_meeting_poll_participants.sql",
      "utf8",
    );

    expect(sql).toContain("create table public.meeting_poll_participants");
    expect(sql).toContain("add column dates date[]");
    expect(sql).toContain("drop column starts_on");
    expect(sql).toContain("drop column ends_on");
    expect(sql).toContain("slot_min int not null default 30 check (slot_min in (30, 60))");
    expect(sql).toContain("invite_token uuid not null default gen_random_uuid()");
    expect(sql).toContain("notify_before_due boolean not null default true");
    // 격자 폭 상한은 lib의 MAX_POLL_DAYS와 같은 값이어야 한다.
    expect(sql).toContain(`check (array_length(dates, 1) between 1 and ${MAX_POLL_DAYS})`);

    // 기존 응답을 잃지 않고 옮긴다.
    expect(sql).toContain("insert into public.meeting_poll_participants");
    expect(sql).toContain("drop table public.meeting_poll_responses");

    // 익명 응답은 두 RPC로만. 확정·마감 뒤에는 거부.
    expect(sql).toContain("function public.get_meeting_poll_by_token(p_token uuid)");
    expect(sql).toContain("function public.respond_meeting_poll_by_token(");
    expect(sql).toContain("ALREADY_CONFIRMED");
    expect(sql).toContain("PAST_DUE");
    expect(sql).toContain(
      "grant execute on function public.respond_meeting_poll_by_token(uuid, uuid, timestamptz[]) to anon, authenticated",
    );

    // 알림 타입 추가와 미응답자 알림 RPC
    expect(sql).toContain("meeting_poll_nudge");
    expect(sql).toContain("function public.nudge_meeting_poll(p_poll uuid)");

    expect(sql).toContain("enable row level security");
    expect(sql).toContain('"meeting_poll_participants: staff read"');
    expect(sql).toContain('"meeting_poll_participants: owner write"');
    expect(sql).toContain('"meeting_poll_participants: self respond"');
  });
});

describe("둘러보기 예시 데이터", () => {
  it("추천 구간이 1·2·3위로 갈린다 — 전원 가능 1개, 한 명씩 빠진 것 2개", async () => {
    const { DEMO_MEETING_POLLS, DEMO_MEETING_POLL_PARTICIPANTS } = await import("@/lib/demoData");
    const poll = DEMO_MEETING_POLLS[0];
    const participants = DEMO_MEETING_POLL_PARTICIPANTS.filter((p) => p.poll_id === poll.id);
    const views = toViews(participants);
    const times = pollTimes(poll.start_hour, poll.end_hour, poll.slot_min);

    expect(views.filter((v) => v.responded)).toHaveLength(6);
    expect(views).toHaveLength(7);

    const recs = recommendBlocks(poll.dates, times, views, poll.slot_min);
    expect(recs.map((r) => r.available.length)).toEqual([6, 5, 5]);
    expect(recs[0].missing).toHaveLength(0);
    expect(recs.every((r) => r.durationMin === MIN_BLOCK_MIN)).toBe(true);
  });
});
