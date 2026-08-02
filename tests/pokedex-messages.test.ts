import { describe, expect, it } from "vitest";

describe("도감봇 메시지", () => {
  it("포획 시도·성공·실패와 출현을 슬랙 태그 문구로 만든다", async () => {
    const module = await import("@/lib/pokedex/messages").catch(() => null);

    expect(module).not.toBeNull();
    expect(module?.appearanceMessage("꼬부기", "pokeball")).toContain(":pokeball:");
    expect(module?.throwMessage("U1")).toBe("<@U1>이 몬스터볼을 던졌어요!");
    expect(module?.resultMessage("U1", "꼬부기", "caught")).toBe("🎉 <@U1>이 꼬부기 포획에 성공했어요!");
    expect(module?.resultMessage("U1", "꼬부기", "escaped")).toBe("아쉽게도 꼬부기가 도망쳤어요.");
  });
});
