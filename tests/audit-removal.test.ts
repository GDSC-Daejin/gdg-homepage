import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("감사 로그 제거", () => {
  it("관리자 메뉴와 페이지를 노출하지 않는다", async () => {
    const nav = await readFile("src/app/admin/AdminSidebarNav.tsx", "utf8");

    expect(nav).not.toContain('href: "/admin/audit"');
    expect(existsSync("src/app/admin/audit/page.tsx")).toBe(false);
  });

  it("기존 감사 로그 데이터는 보존하고 새 기록만 멈춘다", async () => {
    const migration = await readFile(
      "supabase/migrations/0031_disable_audit_logging.sql",
      "utf8",
    );

    expect(migration).toContain("create or replace function public.log_audit");
    expect(migration).not.toContain("insert into audit_logs");
    expect(migration).not.toContain("drop table");
  });
});
