import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 확률표", () => {
  it("도감 안에서 확률표 탭과 포켓몬별 확률 정보를 제공한다", async () => {
    const page = await readFile("src/app/(member)/pokedex/page.tsx", "utf8");

    expect(page).toContain("내 도감");
    expect(page).toContain("확률표");
    expect(page).toContain("출현 가중치");
    expect(page).toContain("기본 몬스터볼 포획률");
    expect(page).toContain("가중치 비례·중복 없이 선정");
  });
});
