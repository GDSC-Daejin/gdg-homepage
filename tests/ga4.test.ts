import { describe, expect, it } from "vitest";
import {
  mapChannels,
  mapEvents,
  mapPages,
  mapTraffic,
  parseRows,
} from "@/lib/ga4";

const sample = {
  rows: [
    {
      dimensionValues: [{ value: "20260701" }],
      metricValues: [{ value: "12" }, { value: "30" }, { value: "88" }],
    },
    {
      dimensionValues: [{ value: "20260702" }],
      metricValues: [{ value: "9" }, { value: "20" }, { value: "60" }],
    },
  ],
};

describe("parseRows", () => {
  it("dimension과 metric 값을 문자열 행 배열로 편다", () => {
    expect(parseRows(sample)).toEqual([
      ["20260701", "12", "30", "88"],
      ["20260702", "9", "20", "60"],
    ]);
  });

  it("rows가 없으면 빈 배열을 반환한다", () => {
    expect(parseRows({})).toEqual([]);
    expect(parseRows(null)).toEqual([]);
  });
});

describe("mapTraffic", () => {
  it("트래픽 포인트로 매핑하고 숫자로 변환한다", () => {
    expect(mapTraffic(sample)).toEqual([
      { date: "20260701", activeUsers: 12, sessions: 30, pageViews: 88 },
      { date: "20260702", activeUsers: 9, sessions: 20, pageViews: 60 },
    ]);
  });
});

describe("GA4 행 매퍼", () => {
  it("채널 행을 매핑한다", () => {
    expect(
      mapChannels({
        rows: [
          {
            dimensionValues: [{ value: "Organic Search" }],
            metricValues: [{ value: "40" }],
          },
        ],
      }),
    ).toEqual([{ channel: "Organic Search", sessions: 40 }]);
  });

  it("페이지 행을 매핑한다", () => {
    expect(
      mapPages({
        rows: [
          {
            dimensionValues: [{ value: "/apply" }],
            metricValues: [{ value: "15" }],
          },
        ],
      }),
    ).toEqual([{ path: "/apply", views: 15 }]);
  });

  it("이벤트 행을 매핑한다", () => {
    expect(
      mapEvents({
        rows: [
          {
            dimensionValues: [{ value: "apply_submit" }],
            metricValues: [{ value: "7" }],
          },
        ],
      }),
    ).toEqual([{ name: "apply_submit", count: 7 }]);
  });
});
