import { describe, expect, it } from "vitest";
import { DAILY_MESSAGES, dailyMessage, evolutionMessage, seasonEndMessage, threadSummary } from "@/lib/squirtle/messages";

describe("일일 메시지", () => {
  it("문구가 15개다 (구미베어처럼 매주 같은 문구를 쓰지 않는다)", () => {
    expect(DAILY_MESSAGES).toHaveLength(15);
    expect(new Set(DAILY_MESSAGES).size).toBe(15);
  });
  it("단계 이모지와 이름을 안내한다", () => {
    const text = dailyMessage(2, "wartortle", 0);
    expect(text).toContain(":wartortle:");
    expect(text).toContain("어니부기");
  });
  it("index를 문구 개수로 나눈 나머지로 고른다", () => expect(dailyMessage(1, "squirtle", 15)).toBe(dailyMessage(1, "squirtle", 0)));
  it("외부 링크를 넣지 않는다", () => {
    for (let i = 0; i < DAILY_MESSAGES.length; i += 1) expect(dailyMessage(1, "squirtle", i)).not.toMatch(/https?:\/\//);
  });
});

describe("스레드 집계", () => {
  it("꼬부기면 다음 단계인 어니부기까지 남은 잔을 센다", () => {
    const text = threadSummary({ participants: ["U1"], total: 30, stage: 1, stage2Threshold: 80, stage3Threshold: 200, emoji: "squirtle" });
    expect(text).toContain("어니부기까지 50잔");
    expect(text).not.toContain("거북왕");
  });
  it("어니부기면 거북왕까지 남은 잔을 센다", () => {
    const text = threadSummary({ participants: ["U1", "U2"], total: 158, stage: 2, stage2Threshold: 80, stage3Threshold: 200, emoji: "squirtle" });
    expect(text).toContain("2명");
    expect(text).toContain("어니부기와 함께했어요");
    expect(text).toContain("<@U1>");
    expect(text).toContain("<@U2>");
    expect(text).toContain("거북왕까지 42잔");
    expect(text).toContain(":squirtle:");
  });
  it("거북왕이면 남은 잔 문구를 뺀다", () => {
    const text = threadSummary({ participants: ["U1"], total: 210, stage: 3, stage2Threshold: 80, stage3Threshold: 200, emoji: "squirtle" });
    expect(text).not.toContain("남았");
    expect(text).toContain("거북왕");
  });
  it("목표를 넘겨도 음수로 내려가지 않는다", () => {
    const text = threadSummary({ participants: ["U1"], total: 95, stage: 1, stage2Threshold: 80, stage3Threshold: 200, emoji: "squirtle" });
    expect(text).toContain("어니부기까지 0잔");
  });
  it("참여자가 없으면 빈 문자열을 돌려준다", () => {
    expect(threadSummary({ participants: [], total: 0, stage: 1, stage2Threshold: 80, stage3Threshold: 200, emoji: "squirtle" })).toBe("");
  });
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
  it("새 이모지를 달았으면 그걸 누르라고 안내한다", () => {
    const text = evolutionMessage({ stage: 2, total: 80, top3, participantCount: 21, nextEmoji: "wartortle" });
    expect(text).toContain(":wartortle:");
    // 이전 이모지도 계속 인정된다는 걸 알려야 오늘 안 마신 사람이 헷갈리지 않는다
    expect(text).toContain("이전 이모지도");
  });
  it("새 이모지를 못 달았으면 누르라는 안내도 하지 않는다", () => {
    const text = evolutionMessage({ stage: 3, total: 200, top3, participantCount: 21 });
    expect(text).not.toContain("눌러주세요");
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
    const text = seasonEndMessage({ stage: 2, total: 143, top3: [{ slack_user_id: "U1", count: 20 }], bonuses: [30, 20, 10], emoji: "squirtle" });
    expect(text).toContain("어니부기");
    expect(text).toContain("143");
    expect(text).toContain("30포인트");
  });
});
