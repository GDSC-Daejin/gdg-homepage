import { readFile } from "node:fs/promises";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listWorkspaceMembers } from "@/lib/slack/api";
import { suggestSlackMatch } from "@/lib/squirtle/backfill";

let action = "";
let page = "";
let list = "";
let sql = "";
let errors = "";

beforeAll(async () => {
  [action, page, list, sql, errors] = await Promise.all([
    readFile("src/actions/slack-link.ts", "utf8"),
    readFile("src/app/admin/bots/links/page.tsx", "utf8"),
    readFile("src/app/admin/bots/links/SlackLinkList.tsx", "utf8"),
    readFile("supabase/migrations/0051_admin_set_slack_link.sql", "utf8"),
    readFile("src/lib/errors.ts", "utf8"),
  ]);
});

const originalFetch = globalThis.fetch;

function mockFetch(payload: unknown) {
  const spy = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200 }),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

beforeEach(() => {
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("워크스페이스 멤버 목록", () => {
  it("id·표시이름·이메일을 함께 돌려준다 (드롭다운에 이름이 필요하다)", async () => {
    mockFetch({
      ok: true,
      members: [
        {
          id: "U1",
          is_bot: false,
          deleted: false,
          profile: { display_name: "Yuki", real_name: "옥유키", email: "Yuki@Naver.com" },
        },
      ],
      response_metadata: { next_cursor: "" },
    });

    const members = await listWorkspaceMembers();
    expect(members).toEqual([{ id: "U1", name: "Yuki", email: "yuki@naver.com" }]);
  });

  it("display_name이 비면 real_name으로 대체한다", async () => {
    mockFetch({
      ok: true,
      members: [
        { id: "U1", is_bot: false, deleted: false, profile: { display_name: "", real_name: "옥유키", email: "a@b.com" } },
      ],
      response_metadata: { next_cursor: "" },
    });

    expect((await listWorkspaceMembers())[0].name).toBe("옥유키");
  });

  it("봇과 삭제된 사용자를 제외한다", async () => {
    mockFetch({
      ok: true,
      members: [
        { id: "U1", is_bot: true, deleted: false, profile: { real_name: "bot", email: "b@x.com" } },
        { id: "U2", is_bot: false, deleted: true, profile: { real_name: "gone", email: "g@x.com" } },
      ],
      response_metadata: { next_cursor: "" },
    });

    expect(await listWorkspaceMembers()).toEqual([]);
  });

  it("이메일이 없는 사용자도 포함한다 (수동 연결 대상이다)", async () => {
    mockFetch({
      ok: true,
      members: [{ id: "U1", is_bot: false, deleted: false, profile: { real_name: "노메일" } }],
      response_metadata: { next_cursor: "" },
    });

    expect(await listWorkspaceMembers()).toEqual([{ id: "U1", name: "노메일", email: "" }]);
  });
});

describe("추천 매칭", () => {
  const slack = [
    { id: "U1", name: "Min", email: "min@gmail.com" },
    { id: "U2", name: "Yuki", email: "yuki@naver.com" },
  ];

  it("이메일이 같으면 그 슬랙 계정을 추천한다", () => {
    expect(suggestSlackMatch("MIN@gmail.com", slack)).toBe("U1");
  });

  it("맞는 이메일이 없으면 추천하지 않는다 (네이버·지메일이 갈리는 경우)", () => {
    expect(suggestSlackMatch("yuki@gmail.com", slack)).toBeNull();
  });

  it("이메일이 비면 추천하지 않는다", () => {
    expect(suggestSlackMatch("", slack)).toBeNull();
    expect(suggestSlackMatch(null, slack)).toBeNull();
  });
});

describe("서버 액션", () => {
  it("어드민만 호출할 수 있다", () => {
    expect(action).toContain("requireAdmin()");
  });

  it("둘러보기 모드에서는 쓰지 않는다", () => {
    expect(action).toContain("isDemoMode()");
  });

  it("해제는 null로 처리한다", () => {
    expect(action).toContain("slackUserId: string | null");
  });

  it("profiles 직접 update 대신 admin RPC를 쓴다 (profiles 쓰기는 봉인돼 있다)", () => {
    expect(action).toContain('rpc("admin_set_slack_link"');
    expect(action).not.toContain('.from("profiles")');
  });

  it("변경 후 목록을 다시 그린다", () => {
    expect(action).toContain('revalidatePath("/admin/bots/links")');
  });
});

describe("admin_set_slack_link RPC", () => {
  it("어드민만 통과시킨다", () => {
    expect(sql).toContain("if not public.is_admin() then raise exception 'FORBIDDEN'");
  });

  it("security definer로 봉인된 컬럼을 우회한다", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
  });

  it("한 슬랙 계정을 두 회원에게 붙이지 못하게 막는다", () => {
    expect(sql).toContain("SLACK_ALREADY_LINKED");
  });

  it("빈 문자열은 해제로 처리한다 (드롭다운 기본값이 빈 문자열이다)", () => {
    expect(sql).toContain("nullif");
  });

  it("anon에서 execute를 회수하고 authenticated에만 준다", () => {
    expect(sql).toContain("revoke execute on function public.admin_set_slack_link(uuid, text) from public, anon");
    expect(sql).toContain("grant execute on function public.admin_set_slack_link(uuid, text) to authenticated");
  });

  it("에러 코드가 한국어로 매핑된다", () => {
    expect(errors).toContain("SLACK_ALREADY_LINKED");
  });
});

describe("연결 화면", () => {
  it("회원의 이메일과 슬랙 연결 상태를 함께 읽는다", () => {
    expect(page).toContain("slack_user_id");
    expect(page).toContain("email");
  });

  it("미연결 회원을 먼저 보여준다", () => {
    expect(list).toContain("unlinkedFirst");
  });

  it("연결 안 된 회원을 눈에 띄게 표시한다", () => {
    expect(list).toContain("연결 안 됨");
  });

  it("회원마다 슬랙 계정을 골라 연결한다", () => {
    expect(list).toContain("setSlackLink");
  });

  it("디자인 시스템의 Select·Badge를 쓴다 (native select·수제 배지 금지)", () => {
    expect(list).toContain('from "@/components/Select"');
    expect(list).toContain('from "@/components/Badge"');
    expect(list).not.toContain("<select");
    expect(list).not.toContain("rounded-full bg-warning-soft");
  });

  it("슬랙 목록을 못 가져왔으면 빈 드롭다운 대신 이유를 알려준다", () => {
    expect(list).toContain("슬랙 멤버 목록을 가져오지 못했어요");
    expect(list).toContain("slackMembers.length === 0");
  });

  it("이미 연결된 회원에는 드롭다운을 띄우지 않는다 (해제 후 다시 연결)", () => {
    expect(list).toContain("해제");
  });
});
