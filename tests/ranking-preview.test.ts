import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("랭킹전 프리뷰", () => {
  it("공격 뒤 전투 연출을 열고, 빈 덱 슬롯은 포켓몬 선택 영역으로 이동한다", async () => {
    const preview = await readFile("src/app/ranking-preview/RankingPreview.tsx", "utf8");

    expect(preview).toContain("setBattle(battle)");
    expect(preview).toContain("RankingBattleAnimation");
    expect(preview).toContain("pickerRef.current?.scrollIntoView");
  });

  it("덱 카드 자체를 누르면 편집 대상으로 바꾼다", async () => {
    const preview = await readFile("src/app/ranking-preview/RankingPreview.tsx", "utf8");

    expect(preview).toContain('onClick={() => setEditing(kind)}');
    expect(preview).not.toContain(">이 덱 편집<");
  });

  it("태블릿과 모바일에서 한 열·압축 그리드로 전환한다", async () => {
    const css = await readFile("src/app/ranking-preview/ranking-preview.css", "utf8");

    expect(css).toContain("@media (max-width: 1279px)");
    expect(css).toContain("@media (max-width: 599px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });
});
