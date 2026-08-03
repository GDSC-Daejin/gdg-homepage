import { describe, expect, it } from "vitest";
import { summarizeAnalytics } from "@/app/admin/analytics/analytics-data";

describe("summarizeAnalytics", () => {
  it("기간별 traffic과 추적 Event를 같은 지표로 요약한다", () => {
    const summary = summarizeAnalytics(
      [{ activeUsers: 10, sessions: 20, pageViews: 30 }],
      [{ activeUsers: 5, sessions: 10, pageViews: 10 }],
      [{ name: "apply_submit", count: 2 }],
      [{ name: "apply_submit", count: 1 }],
    );

    expect(summary.totals).toEqual({ users: 10, sessions: 20, views: 30 });
    expect(summary.visits).toBe(2);
    expect(summary.depth).toBe(1.5);
    expect(summary.conversions).toBe(2);
    expect(summary.eventRows.find((row) => row.name === "apply_submit")?.count).toBe(2);
  });
});
