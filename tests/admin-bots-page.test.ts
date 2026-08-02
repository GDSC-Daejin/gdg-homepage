import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";
let action = "";
let page = "";
let manager = "";
let nav = "";

beforeAll(async () => {
  [sql, action, page, manager, nav] = await Promise.all([
    readFile("supabase/migrations/0047_bots_admin_write.sql", "utf8"),
    readFile("src/actions/bot.ts", "utf8"),
    readFile("src/app/admin/bots/page.tsx", "utf8"),
    readFile("src/app/admin/bots/BotToggleList.tsx", "utf8"),
    readFile("src/app/admin/AdminSidebarNav.tsx", "utf8"),
  ]);
});

describe("bots 쓰기 권한", () => {
  it("어드민 전체 권한 정책을 둔다 (레포의 단순 CRUD 관례)", () => {
    expect(sql).toContain("for all using (public.is_admin())");
    expect(sql).toContain("with check (public.is_admin())");
  });

  it("읽기 전용 정책은 대체한다", () => {
    expect(sql).toContain("drop policy");
    expect(sql).toContain("bots: admin read");
  });
});

describe("서버 액션", () => {
  it("어드민만 호출할 수 있다", () => {
    expect(action).toContain("requireAdmin()");
  });

  it("둘러보기 모드에서는 실제로 쓰지 않는다", () => {
    expect(action).toContain("isDemoMode()");
  });

  it("slug로 해당 봇만 갱신한다", () => {
    expect(action).toContain('.eq("slug", slug)');
    expect(action).toContain("active");
  });

  it("변경 후 목록을 다시 그린다", () => {
    expect(action).toContain('revalidatePath("/admin/bots")');
  });
});

describe("어드민 화면", () => {
  it("봇 목록을 slug 순으로 가져온다", () => {
    expect(page).toContain('.from("bots")');
    expect(page).toContain('.order("slug"');
  });

  it("봇마다 개별 토글을 렌더한다 (전체 일괄이 아니다)", () => {
    expect(manager).toContain("bots.map");
    expect(manager).toContain("bot.slug");
    expect(manager).toContain("bot.active");
  });

  it("설명은 DB에서 읽는다 (봇 추가 시 코드 수정이 필요 없어야 한다)", () => {
    expect(manager).toContain("bot.description");
    expect(page).toContain("description");
    // 특정 봇 이야기가 컴포넌트에 박혀 있으면 안 된다
    expect(manager).not.toContain("꼬북");
    expect(manager).not.toContain("물 마시기");
  });

  it("꺼진 봇이 무엇을 의미하는지 알려준다", () => {
    expect(manager).toContain("쉬는 중");
    expect(manager).toContain("이미 올라간 글의 리액션은 그대로 인정돼요");
  });

  it("사이드바 관리 그룹에 진입점을 둔다", () => {
    expect(nav).toContain('href: "/admin/bots"');
    expect(nav).toContain('label: "봇"');
  });
});
