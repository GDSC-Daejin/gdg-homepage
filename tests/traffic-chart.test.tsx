import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrafficChart } from "@/app/admin/analytics/TrafficChart";

describe("TrafficChart", () => {
  it("빈 데이터에는 안내를 렌더한다", () => {
    expect(renderToStaticMarkup(<TrafficChart data={[]} />)).toContain(
      "데이터가 없습니다.",
    );
  });

  it("세션 데이터에는 SVG polyline을 렌더한다", () => {
    const markup = renderToStaticMarkup(
      <TrafficChart
        data={[
          { date: "20260701", activeUsers: 12, sessions: 30, pageViews: 88 },
          { date: "20260702", activeUsers: 9, sessions: 20, pageViews: 60 },
        ]}
      />,
    );

    expect(markup).toContain("<polyline");
    expect(markup).toMatch(/points="0,0 640,53\.3+/);
  });
});
