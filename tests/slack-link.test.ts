import { readFile } from "node:fs/promises";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listWorkspaceMembers } from "@/lib/slack/api";
import { suggestSlackMatch } from "@/lib/squirtle/backfill";

let action = "";
let page = "";
let list = "";

beforeAll(async () => {
  [action, page, list] = await Promise.all([
    readFile("src/actions/slack-link.ts", "utf8"),
    readFile("src/app/admin/bots/links/page.tsx", "utf8"),
    readFile("src/app/admin/bots/links/SlackLinkList.tsx", "utf8"),
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

  it("이미 다른 회원이 쓰는 슬랙 계정이면 안내한다", () => {
    expect(action).toContain("이미 다른 회원");
  });

  it("변경 후 목록을 다시 그린다", () => {
    expect(action).toContain('revalidatePath("/admin/bots/links")');
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
    expect(list).toContain("<select");
    expect(list).toContain("setSlackLink");
  });
});
