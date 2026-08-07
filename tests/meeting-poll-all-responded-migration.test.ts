import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { latestFunction } from "./migration-sql";

let sql = "";
let claim = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0098_meeting_poll_all_responded.sql", "utf8");
  claim = await latestFunction("meeting_poll_claim_all_responded");
});

describe("전원 응답 알림 마이그레이션", () => {
  it("발송 여부를 기록할 컬럼을 둔다", () => {
    expect(sql).toContain("add column all_responded_notified_at timestamptz");
  });

  it("기존 폴을 일괄로 채우지 않는다", () => {
    // 알림은 응답 저장 시점에만 트리거된다. 백필은 필요 없고, 조용히 지난 폴을 죽인다.
    expect(sql).not.toMatch(/update public\.meeting_polls[\s\S]*set all_responded_notified_at/);
  });
});

describe("meeting_poll_claim_all_responded", () => {
  it("이미 보낸 폴은 다시 선점하지 못한다", () => {
    // 이 조건이 곧 선점이다. 빠지면 마지막 사람이 저장할 때마다 알림이 나간다.
    expect(claim).toContain("p.all_responded_notified_at is null");
  });

  it("확정된 폴은 건너뛴다", () => {
    expect(claim).toContain("p.confirmed_at is null");
  });

  it("미응답자가 하나라도 있으면 선점하지 않는다", () => {
    expect(claim).toMatch(/not exists \([\s\S]*responded_at is null/);
  });

  it("참여자가 아무도 없는 폴을 전원 응답으로 보지 않는다", () => {
    expect(claim).toMatch(/and exists \(select 1 from meeting_poll_participants/);
  });

  it("이름·이메일을 돌려주지 않는다", () => {
    expect(claim).not.toContain("pa.name");
    expect(claim).not.toContain("pa.email");
  });
});

describe("실행 권한", () => {
  it("폴 id 판은 로그인 사용자에게만 준다", () => {
    expect(sql).toContain("revoke execute on function public.meeting_poll_claim_all_responded(uuid) from public, anon");
    expect(sql).toContain("grant execute on function public.meeting_poll_claim_all_responded(uuid) to authenticated");
  });

  it("익명 응답자는 토큰 판만 부를 수 있다", () => {
    expect(sql).toContain("grant execute on function public.meeting_poll_claim_all_responded_by_token(uuid) to anon, authenticated");
  });
});
