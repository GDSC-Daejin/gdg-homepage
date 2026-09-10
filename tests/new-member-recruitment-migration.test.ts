import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("신규 멤버 모집 확장 마이그레이션", () => {
  it("지원서 상태 이력과 전이 제한을 정의한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0115_new_member_recruitment.sql",
      "utf8",
    );

    expect(migration).toContain("create table if not exists public.application_status_history");
    expect(migration).toContain("create or replace function public.admin_set_application_status");
    expect(migration).toContain("INVALID_TRANSITION");
    expect(migration).toContain("admin_reopen_interview");
    expect(migration).toContain("p_reason text");
    expect(migration).toContain("left(coalesce(p_reason, ''), 500)");
  });

  it("서류·면접 평가와 합격자 가입 초대를 운영진 전용으로 정의한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0115_new_member_recruitment.sql",
      "utf8",
    );

    expect(migration).toContain("create table if not exists public.application_evaluations");
    expect(migration).toContain("unique (application_id, evaluator_id, stage)");
    expect(migration).toContain("create table if not exists public.application_onboarding_invites");
    expect(migration).toContain("application_onboarding_invites_active");
    expect(migration).toContain("admin_issue_application_onboarding_invite");
  });

  it("가입 연결 시 이메일과 초대 토큰을 함께 검증한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0115_new_member_recruitment.sql",
      "utf8",
    );

    expect(migration).toContain("link_application_to_profile");
    expect(migration).toContain("lower(v_auth_email) <> lower(v_invite.target_email)");
    expect(migration).toContain("EMAIL_MISMATCH");
    expect(migration).toContain("set used_at = now(), linked_profile_id = auth.uid()");
  });
});
