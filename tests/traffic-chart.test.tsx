import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrafficChart } from "@/app/admin/analytics/TrafficChart";

const DATA = [
  { date: "20260701", activeUsers: 12, sessions: 30, pageViews: 88 },
  { date: "20260702", activeUsers: 9, sessions: 20, pageViews: 60 },
];

describe("TrafficChart", () => {
  it("빈 데이터에는 안내를 렌더한다", () => {
    expect(
      renderToStaticMarkup(<TrafficChart data={[]} metric="sessions" />),
    ).toContain("데이터가 없습니다.");
  });

  it("세션 데이터에는 SVG polyline을 렌더한다", () => {
    const markup = renderToStaticMarkup(
      <TrafficChart data={DATA} metric="sessions" />,
    );

    expect(markup).toContain("<polyline");
    // 최대값(30)이 축 상단, 20은 그 2/3 높이에 찍힌다.
    expect(markup).toMatch(/points="40,20 708,78/);
    expect(markup).toContain("7/1 · 30번");
  });

  it("metric에 따라 값과 단위가 바뀐다", () => {
    const markup = renderToStaticMarkup(
      <TrafficChart data={DATA} metric="users" />,
    );

    expect(markup).toContain("7/1 · 12명");
    expect(markup).not.toContain("30번");
    // hover 점도 선택된 metric 축을 따라야 한다(축 최대 20 기준 12 → cy 89.6).
    expect(markup).toMatch(/cy="89\.6/);
  });
});
