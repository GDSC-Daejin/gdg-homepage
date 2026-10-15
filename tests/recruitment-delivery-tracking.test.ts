import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("모집 외부 연동 추적", () => {
  it("계획서가 Ready 상태이고 전달·RSVP 기준을 명시한다", () => {
    const plan = readFileSync(`${root}/docs/plans/new-member-recruitment.md`, "utf8");
    expect(plan).toContain("> 상태: Ready");
    expect(plan).toContain("email.delivered");
    expect(plan).toContain("accepted");
    expect(plan).toContain("declined");
  });

  it("중복 방지 가능한 메일 이벤트와 Calendar 상태 컬럼을 정의한다", () => {
    const migration = readFileSync(`${root}/supabase/migrations/0117_recruitment_delivery_tracking.sql`, "utf8");
    expect(migration).toContain("application_email_logs");
    expect(migration).toContain("application_email_events");
    expect(migration).toContain("provider_event_id text not null unique");
    expect(migration).toContain("applicant_calendar_response");
  });

  it("Resend webhook이 서명과 전달 상태를 처리한다", () => {
    const route = readFileSync(`${root}/src/app/api/webhooks/resend/route.ts`, "utf8");
    const webhook = readFileSync(`${root}/src/lib/resend-webhook.ts`, "utf8");
    expect(webhook).toContain("svix-signature");
    expect(webhook).toContain('"email.delivered"');
    expect(webhook).toContain('"email.bounced"');
    expect(route).toContain("verifyResendSignature");
    expect(route).toContain("provider_event_id");
  });
});
