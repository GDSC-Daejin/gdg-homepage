import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 관리 목록 표면", () => {
  it("필터와 표를 별도 카드로 표시한다", async () => {
    const page = await readFile("src/app/admin/members/page.tsx", "utf8");

    expect(page).toContain(
      "rounded-xl border border-gray-200 bg-white p-4 shadow-card sm:p-6",
    );
    expect(page).toContain(">회원 목록</h2>");
    expect(page).toContain(
      "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card",
    );
    expect(page).toContain('academicStatus?: string');
    expect(page).toContain('query = query.eq("academic_status", academicStatus)');
    expect(page).toContain(">전화번호</th>");
    expect(page).toContain(">재학여부</th>");
  });

  it("전체 회원 목록에서는 승인 대기 회원을 제외한다", async () => {
    const page = await readFile("src/app/admin/members/page.tsx", "utf8");

    expect(page).toContain('let members: Profile[] = DEMO_MEMBERS.filter((m) => !!m.approved_at)');
    expect(page).toContain('else query = query.not("approved_at", "is", null)');
  });

  it("재학여부는 요청한 네 상태만 저장한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0034_member_academic_status.sql",
      "utf8",
    );

    expect(migration).toContain(
      "check (academic_status in ('enrolled', 'leave', 'graduated', 'completed'))",
    );
    expect(migration).toContain("create or replace function public.admin_set_academic_status");
  });

  it("미선택 재학여부는 빈 값으로 저장하고 목록에서는 대시로 표시한다", async () => {
    const [migration, row, onboarding, profile] = await Promise.all([
      readFile("supabase/migrations/0034_member_academic_status.sql", "utf8"),
      readFile("src/app/admin/members/MemberRow.tsx", "utf8"),
      readFile("src/app/onboarding/OnboardingForm.tsx", "utf8"),
      readFile("src/app/(member)/profile/ProfileForm.tsx", "utf8"),
    ]);

    expect(migration).toContain("add column academic_status text");
    expect(migration).not.toContain("academic_status text not null default");
    expect(migration).toContain("grant update (academic_status) on public.profiles to authenticated");
    expect(row).toContain('academicStatus ? ACADEMIC_STATUS_LABELS[academicStatus] : "-"');
    expect(onboarding).toContain('name="academic_status"');
    expect(profile).toContain('name="academic_status"');
  });
});
