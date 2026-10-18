import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { saveNoticeTemplate } from "@/actions/notice";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/community", () => ({ getCommunity: vi.fn() }));
vi.mock("@/lib/slack", () => ({ postSlack: vi.fn() }));
// isDemoMode()가 cookies()를 읽어서 요청 컨텍스트 밖에서는 그대로 터진다
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn().mockResolvedValue(false) }));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

function mockInsert(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, insert };
}

describe("saveNoticeTemplate", () => {
  it("이름·제목·본문을 작성자와 함께 notice_templates에 저장한다", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1" } as never);
    const { from, insert } = mockInsert();

    await expect(
      saveNoticeTemplate(form({ name: " 정기 세션 ", title: "[N]월 정기 세션", body: "📍 장소: 공학관\n\n본문" })),
    ).resolves.toEqual({});
    expect(from).toHaveBeenCalledWith("notice_templates");
    expect(insert).toHaveBeenCalledWith({
      name: "정기 세션",
      title: "[N]월 정기 세션",
      body: "📍 장소: 공학관\n\n본문",
      created_by: "admin-1",
    });
  });

  it("이름이 없거나 내용이 비어 있으면 저장하지 않는다", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1" } as never);
    const { insert } = mockInsert();

    await expect(saveNoticeTemplate(form({ name: " ", title: "제목", body: "" }))).resolves.toEqual({
      error: "템플릿 이름을 입력해주세요",
    });
    await expect(saveNoticeTemplate(form({ name: "빈 템플릿", title: "", body: "" }))).resolves.toEqual({
      error: "저장할 내용이 없어요. 제목이나 본문을 먼저 써 주세요",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("DB 오류를 숨기지 않고 돌려준다", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1" } as never);
    mockInsert({ message: "boom" });

    const result = await saveNoticeTemplate(form({ name: "정기 세션", title: "제목", body: "" }));
    expect(result.error).toBeTruthy();
  });
});

describe("notice_templates 마이그레이션", () => {
  it("운영진만 읽고 쓸 수 있다", async () => {
    const sql = await readFile("supabase/migrations/0125_notice_templates.sql", "utf8");
    expect(sql).toContain("create table public.notice_templates");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("for all using (public.is_admin()) with check (public.is_admin())");
  });
});
