import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isOrganizer, isStaff, type Profile } from "@/lib/types";

const profile = (email: string, role: Profile["role"]) => ({ email, role });

describe("개발자 모드", () => {
  it("개발자 이메일을 organizer 권한으로 취급한다", () => {
    const developer = profile("jieunsse@gmail.com", "member");

    expect(isStaff(developer)).toBe(true);
    expect(isOrganizer(developer)).toBe(true);
  });

  it("RLS도 같은 이메일을 운영자로 취급한다", async () => {
    const migration = await readFile("supabase/migrations/0096_developer_mode.sql", "utf8");

    expect(migration).toContain("create or replace function public.is_admin()");
    expect(migration).toContain("create or replace function public.is_organizer()");
    expect(migration).toContain("'jieunsse@gmail.com'");
  });
});
