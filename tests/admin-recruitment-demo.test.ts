import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let data = "";
let interviews = "";
let conversions = "";
let sidebar = "";
let proxy = "";

beforeAll(async () => {
  [data, interviews, conversions, sidebar, proxy] = await Promise.all([
    readFile("src/lib/demoData.ts", "utf8"),
    readFile("src/app/admin/interviews/page.tsx", "utf8"),
    readFile("src/app/admin/applications/conversions/page.tsx", "utf8"),
    readFile("src/app/admin/AdminSidebar.tsx", "utf8"),
    readFile("src/proxy.ts", "utf8"),
  ]);
});

describe("모집 둘러보기 데이터", () => {
  it("모집 시즌·지원서·면접·전환 더미데이터를 제공한다", () => {
    expect(data).toContain("DEMO_RECRUITING_SETTINGS");
    expect(data).toContain("DEMO_APPLICATION_EVALUATIONS");
    expect(data).toContain("DEMO_INTERVIEW_SLOTS");
    expect(data).toContain("DEMO_APPLICATION_ONBOARDING_INVITES");
  });

  it("면접 일정과 합격자 전환 화면이 둘러보기 데이터를 사용한다", () => {
    expect(interviews).toContain("if (demo)");
    expect(interviews).toContain("DEMO_INTERVIEW_SLOTS");
    expect(conversions).toContain("if (demo)");
    expect(conversions).toContain("DEMO_APPLICATION_ONBOARDING_INVITES");
  });

  it("면접 둘러보기 경로와 운영 화면 복귀 버튼을 제공한다", () => {
    expect(proxy).toContain("interviews");
    expect(sidebar).toContain("실제 운영 화면으로 돌아가기");
    expect(sidebar).toContain('href="/admin"');
  });
});
