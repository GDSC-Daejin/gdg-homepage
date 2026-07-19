import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("groups 마이그레이션", () => {
  it("테이블·RLS·RPC를 정의한다", async () => {
    const sql = await readFile("supabase/migrations/0030_groups.sql", "utf8");

    expect(sql).toContain("create table public.groups");
    expect(sql).toContain("check (type in ('study', 'project'))");
    expect(sql).toContain(
      "check (status in ('recruiting', 'active', 'archived'))",
    );
    expect(sql).toContain("is_public boolean not null default false");
    expect(sql).toContain("create table public.group_members");
    expect(sql).toContain("primary key (group_id, user_id)");
    expect(sql).toContain("references public.groups(id) on delete cascade");

    expect(sql).toContain("enable row level security");
    expect(sql).toContain('"groups: member read"');
    expect(sql).toContain('"groups: public read"');
    expect(sql).toContain('"groups: admin all"');
    expect(sql).toContain('"group_members: member read"');
    expect(sql).toContain('"group_members: self leave"');
    expect(sql).toContain('"group_members: admin all"');

    expect(sql).toContain("function public.join_group(p_group uuid)");
    expect(sql).toContain("NOT_RECRUITING");
    expect(sql).toContain("FULL");
    expect(sql).toContain("revoke execute on function public.join_group(uuid)");
    expect(sql).toContain(
      "grant execute on function public.join_group(uuid) to authenticated",
    );

    expect(sql).toContain("function public.public_groups()");
    expect(sql).toContain(
      "grant execute on function public.public_groups() to anon, authenticated",
    );
  });

  it("TypeScript 타입이 SQL 제약과 일치한다", async () => {
    const types = await readFile("src/lib/types.ts", "utf8");
    expect(types).toContain('export type GroupType = "study" | "project"');
    expect(types).toContain(
      'export type GroupStatus = "recruiting" | "active" | "archived"',
    );
    expect(types).toContain("export interface Group");
    expect(types).toContain("export interface GroupMember");
  });
});
