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

  it("작은 화면에서도 내부 탭을 가로 스크롤로 유지한다", async () => {
    const css = await readFile("src/app/ranking-preview/ranking-preview.css", "utf8");

    expect(css).toContain(".rp-tabs {\n    display: flex;");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain("overscroll-behavior-x: contain");
  });

  it("작은 화면의 파티는 양끝 정렬 대신 촘촘하게 모은다", async () => {
    const css = await readFile("src/app/ranking-preview/ranking-preview.css", "utf8");

    expect(css).toContain(".rp-partyslot {\n    width: 96px;\n    min-width: 0;");
    expect(css).toContain(".rp-partyslot {\n    width: 88px;");
  });

  it("PC에서도 파티와 남은 공격 영역을 불필요하게 넓히지 않는다", async () => {
    const css = await readFile("src/app/ranking-preview/ranking-preview.css", "utf8");

    expect(css).toContain("width: min(100%, 300px);");
    expect(css).toContain(".rp-partyrow {\n  display: flex;\n  align-items: flex-end;\n  gap: 8px;");
  });

  it("홈에서는 시즌 랭킹 3위까지만, 상세에서는 전체를 보여준다", async () => {
    const preview = await readFile("src/app/ranking-preview/RankingPreview.tsx", "utf8");

    expect(preview).toContain("data.leaderboard.slice(0, 3)");
    expect(preview).toContain('setTab("ranking")');
    expect(preview).toContain('{tab === "ranking" &&');
  });

  it("프리오픈에는 시즌 순위 대신 내일 오픈 안내를 보여준다", async () => {
    const preview = await readFile("src/app/ranking-preview/RankingPreview.tsx", "utf8");

    expect(preview).toContain("preopen = false");
    expect(preview).toContain('preopen ? `프리시즌 D-${PRESEASON_DAYS}` : `시즌 D-${season.daysLeft}`');
    expect(preview).toContain("{opensOn}에 오픈됩니다!");
    expect(preview).toContain("오늘 덱을 설정하면 내일부터 바로 랭킹전에 참여할 수 있어요.");
  });

  it("동점 회원도 고유한 id로 랭킹 행을 구분한다", async () => {
    const preview = await readFile("src/app/ranking-preview/RankingPreview.tsx", "utf8");

    expect(preview).toContain('<div key={member.userId} className="rp-rankrow">');
    expect(preview).not.toContain('<div key={member.rank} className="rp-rankrow">');
  });

  it("랭킹전 헤더는 도감 접두어 없이 표시한다", async () => {
    const preview = await readFile("src/app/ranking-preview/RankingPreview.tsx", "utf8");

    expect(preview).toContain('className="rp-brand">랭킹전</span>');
    expect(preview).not.toContain('className="rp-brand">도감 랭킹전</span>');
  });
});
