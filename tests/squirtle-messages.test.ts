import { describe, expect, it } from "vitest";
import { DAILY_MESSAGES, dailyMessage, evolutionMessage, seasonEndMessage, threadSummary } from "@/lib/squirtle/messages";

describe("일일 메시지", () => {
  it("문구가 15개다 (구미베어처럼 매주 같은 문구를 쓰지 않는다)", () => {
    expect(DAILY_MESSAGES).toHaveLength(15);
    expect(new Set(DAILY_MESSAGES).size).toBe(15);
  });
  it("이모지 안내를 포함한다", () => expect(dailyMessage("squirtle", 0)).toContain(":squirtle:"));
  it("index를 문구 개수로 나눈 나머지로 고른다", () => expect(dailyMessage("squirtle", 15)).toBe(dailyMessage("squirtle", 0)));
  it("외부 링크를 넣지 않는다", () => {
    for (let i = 0; i < DAILY_MESSAGES.length; i += 1) expect(dailyMessage("squirtle", i)).not.toMatch(/https?:\/\//);
  });
});

describe("스레드 집계", () => {
  it("참여자를 멘션 형식으로 호명하고 남은 잔을 알려준다", () => {
    const text = threadSummary({ participants: ["U1", "U2"], total: 158, stage: 2, stage3Threshold: 200 });
    expect(text).toContain("2명");
    expect(text).toContain("<@U1>");
    expect(text).toContain("<@U2>");
    expect(text).toContain("42잔");
  });
  it("거북왕이면 남은 잔 문구를 뺀다", () => {
    const text = threadSummary({ participants: ["U1"], total: 210, stage: 3, stage3Threshold: 200 });
    expect(text).not.toContain("남았");
    expect(text).toContain("거북왕");
  });
  it("참여자가 없으면 빈 문자열을 돌려준다", () => expect(threadSummary({ participants: [], total: 0, stage: 1, stage3Threshold: 200 })).toBe(""));
});

describe("진화 축하", () => {
  const top3 = [{ slack_user_id: "U1", count: 24 }, { slack_user_id: "U2", count: 22 }, { slack_user_id: "U3", count: 19 }];
  it("단계 이름과 순위를 메달과 함께 보여준다", () => {
    const text = evolutionMessage({ stage: 3, total: 200, top3, participantCount: 21 });
    expect(text).toContain("거북왕");
    expect(text).toContain("🥇 <@U1> 24잔");
    expect(text).toContain("🥈 <@U2> 22잔");
    expect(text).toContain("🥉 <@U3> 19잔");
    expect(text).toContain("21명");
  });
  it("참여자가 3명 미만이면 있는 만큼만 보여준다", () => {
    const text = evolutionMessage({ stage: 2, total: 80, top3: top3.slice(0, 1), participantCount: 1 });
    expect(text).toContain("🥇 <@U1>");
    expect(text).not.toContain("🥈");
  });
});

describe("시즌 종료", () => {
  it("최종 단계와 보너스 포인트를 안내한다", () => {
    const text = seasonEndMessage({ stage: 2, total: 143, top3: [{ slack_user_id: "U1", count: 20 }], bonuses: [30, 20, 10] });
    expect(text).toContain("어니부기");
    expect(text).toContain("143");
    expect(text).toContain("30포인트");
  });
});
