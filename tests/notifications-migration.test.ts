import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("알림 마이그레이션", () => {
  it("테이블, 인덱스, RLS, RPC 알림 생성을 정의한다", async () => {
    const migration = await readFile("supabase/migrations/0025_notifications.sql", "utf8");

    expect(migration).toContain("create table public.notifications");
    expect(migration).toContain(
      "check (type in ('registration_promoted', 'inquiry_answered', 'badge_awarded'))",
    );
    expect(migration).toContain("references public.profiles(id) on delete cascade");
    expect(migration).toContain("notifications_recipient_created_idx");
    expect(migration).toContain("notifications_unread_idx");
    expect(migration).toContain("where read_at is null");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain('"notifications: own read"');
    expect(migration).toContain('"notifications: own update"');
    expect((migration.match(/insert into notifications/g) ?? [])).toHaveLength(3);
    expect(migration.indexOf("if v_promoted_user is not null")).toBeLessThan(
      migration.indexOf("insert into notifications"),
    );
    expect(migration).toContain("'/events/'");
    expect(migration).toContain("'/inquiries'");
    expect(migration).toContain("'/profile'");
  });

  it("TypeScript 알림 타입이 SQL 타입 제약과 일치한다", async () => {
    const types = await readFile("src/lib/types.ts", "utf8");

    expect(types).toContain("export type NotificationType");
    expect(types).toContain('"registration_promoted"');
    expect(types).toContain('"inquiry_answered"');
    expect(types).toContain('"badge_awarded"');
    expect(types).toContain("export interface Notification");
  });
});
