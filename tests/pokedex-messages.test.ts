import { describe, expect, it } from "vitest";

describe("도감봇 메시지", () => {
  it("포획 시도·성공·실패와 출현을 슬랩 태그 문구로 만든다", async () => {
    const module = await import("@/lib/pokedex/messages").catch(() => null);

    expect(module).not.toBeNull();
    expect(module?.appearanceMessage("꼬부기", "pokeball", "2026-08-02T01:14:00.000Z", "2026-08-02T01:44:00.000Z")).toBe("야생의 꼬부기가 나타났어요! 30분간 출현해요. 오전 10:44까지 :pokeball:을 눌러 포획해보세요.");
    expect(module?.appearanceMessage("고라파덕", "pokeball", "2026-08-02T01:14:00.000Z", "2026-08-02T01:44:00.000Z")).toContain("고라파덕이 나타났어요!");
    expect(module?.throwMessage("U1", "Jayden")).toBe("<@U1>이 몬스터볼을 던졌어요!");
    expect(module?.resultMessage("U1", "Jayden", "꼬부기", "caught")).toBe("🎉 <@U1>이 꼬부기 포획에 성공했어요!");
    expect(module?.resultMessage("U1", "Jayden", "꼬부기", "escaped")).toBe("\uC544\uC27D\uAC8C\uB3C4 <@U1>이 던진 몬스터볼에서 꼬부기가 도망쳤어요.");
    expect(module?.resultMessage("U1", "Jayden", "고라파덕", "escaped")).toContain("고라파덕이 도망쳤어요.");
  });

  it("포획할 수 없는 경우에도 던진 회원을 태그한다", async () => {
    const module = await import("@/lib/pokedex/messages");

    expect(module.rejectionMessage("U1", "Jayden", "no_ball")).toBe("<@U1>의 남은 몬스터볼이 없어요!");
    expect(module.rejectionMessage("U1", "Jayden", "already_thrown")).toBe("<@U1>은 오늘 몬스터볼 세 개를 모두 던졌어요.");
    expect(module.rejectionMessage("U1", "Jayden", "expired", "꼬부기")).toBe("<@U1>이 도착했지만, 꼬부기의 출현은 끝났어요.");
  });

  it("포획 뒤 남은 몬스터볼 수를 태그와 함께 보여준다", async () => {
    const module = await import("@/lib/pokedex/messages");

    expect(module.remainingBallsMessage("U1", 2)).toBe("<@U1>의 남은 몬스터볼: 2개");
    expect(module.rejectionMessage("U1", "Jayden", "no_ball")).toBe("<@U1>의 남은 몬스터볼이 없어요!");
  });

  it("영문 Slack 표시명의 한국어 발음에 맞게 이/가를 붙인다", async () => {
    const module = await import("@/lib/pokedex/messages");

    expect(module.throwMessage("U1", "Jayden")).toBe("<@U1>이 몬스터볼을 던졌어요!");
    expect(module.throwMessage("U2", "Yuki")).toBe("<@U2>가 몬스터볼을 던졌어요!");
    expect(module.throwMessage("U3", "Fox")).toBe("<@U3>가 몬스터볼을 던졌어요!");
    expect(module.throwMessage("U4", "Claire")).toBe("<@U4>가 몬스터볼을 던졌어요!");
    expect(module.throwMessage("U5", "Sun")).toBe("<@U5>이 몬스터볼을 던졌어요!");
  });
});
