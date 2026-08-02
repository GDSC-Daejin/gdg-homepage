import { describe, expect, it } from "vitest";
import { safeDemoPath } from "@/lib/demo-route";

const UUID = "0f2a1c3e-4b5d-6e7f-8a9b-0c1d2e3f4a5b";

describe("safeDemoPath", () => {
  it("실제 상세 화면은 목록으로 돌린다", () => {
    expect(safeDemoPath(`/schedule/${UUID}`)).toBe("/schedule");
    expect(safeDemoPath(`/admin/groups/${UUID}`)).toBe("/admin/groups");
  });

  it("예시 데이터 상세 화면도 목록으로 돌린다", () => {
    expect(safeDemoPath("/schedule/demo-mp1")).toBe("/schedule");
    expect(safeDemoPath("/admin/groups/demo-g2")).toBe("/admin/groups");
  });

  it("id 뒤에 더 붙은 경로도 id 앞에서 자른다", () => {
    expect(safeDemoPath(`/admin/surveys/${UUID}/responses`)).toBe("/admin/surveys");
  });

  it("id가 없는 경로는 그대로 둔다", () => {
    expect(safeDemoPath("/schedule")).toBe("/schedule");
    expect(safeDemoPath("/schedule/past")).toBe("/schedule/past");
    expect(safeDemoPath("/schedule/new")).toBe("/schedule/new");
    expect(safeDemoPath("/admin")).toBe("/admin");
    expect(safeDemoPath("/admin/analytics")).toBe("/admin/analytics");
  });
});
