import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 홈 설문", () => {
  it("최신 열린 설문을 대시보드 카드로 표시하고 배너는 쓰지 않는다", async () => {
    const page = await readFile("src/app/(member)/HomeDashboard.tsx", "utf8");

    expect(page).toContain("const latestSurvey = (openSurveys ?? [])[0]");
    expect(page).toContain('href={`/surveys/${latestSurvey.id}`}');
    expect(page).not.toContain("styles.banner");
  });
});
