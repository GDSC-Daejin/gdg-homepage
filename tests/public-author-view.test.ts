import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("공개 작성자 뷰", () => {
  it("작성자 식별 정보만 definer 뷰로 공개한다", async () => {
    const migration = await readFile(
      "supabase/migrations/0037_public_author_view.sql",
      "utf8",
    );

    expect(migration).toContain("create or replace view public.member_public");
    expect(migration).toContain("security_invoker = false");
    expect(migration).toContain("security_barrier = true");
    expect(migration).toContain("select id, name, nickname from public.profiles");
    expect(migration).toContain("grant select on public.member_public to authenticated");
    expect(migration).not.toMatch(/select[^;]*(phone|student_no|email|major|interests)/s);
  });

  it("게시판 조회가 profiles 대신 안전 뷰를 조인한다", async () => {
    const [list, detail] = await Promise.all([
      readFile("src/components/board/PostListPage.tsx", "utf8"),
      readFile("src/components/board/PostDetailPage.tsx", "utf8"),
    ]);

    expect(list).toContain("member_public(name)");
    expect(detail).toContain("member_public(name)");
    expect(`${list}${detail}`).not.toContain("profiles(name)");
  });
});
