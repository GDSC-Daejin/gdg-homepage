import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reorderApplicationQuestions } from "@/actions/application-question";
import {
  applicationQuestionsOf,
  interviewQuestionsOf,
  interviewerViewOrder,
  reorderPosition,
  saveWithRollback,
  seasonLabel,
} from "@/app/admin/questions/question-model";
import { QuestionsManager } from "@/app/admin/questions/QuestionsManager";
import type { ApplicationQuestion, InterviewQuestion, Position } from "@/lib/types";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: "admin-id" }) }));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function app(id: string, position: Position, sort_order: number, label = id): ApplicationQuestion {
  return { id, position, label, sort_order, created_by: null, created_at: "", updated_at: "" };
}

function iv(id: string, position: Position | null, minute: number): InterviewQuestion {
  const at = `2026-07-01T00:${String(minute).padStart(2, "0")}:00.000Z`;
  return { id, position, body: id, created_by: null, created_at: at, updated_at: at };
}

describe("질문 관리 화면 모델", () => {
  it("지원서 질문은 /apply와 같이 포지션별 sort_order 순서로 보인다", () => {
    const list = [app("c", "frontend", 2), app("a", "frontend", 0), app("x", "backend", 0), app("b", "frontend", 1)];
    expect(applicationQuestionsOf(list, "frontend").map((q) => q.id)).toEqual(["a", "b", "c"]);
  });

  it("순서를 바꾸면 그 포지션만 0부터 다시 매기고 다른 포지션은 건드리지 않는다", () => {
    const list = [app("a", "frontend", 0), app("b", "frontend", 1), app("c", "frontend", 2), app("x", "backend", 5)];
    const next = reorderPosition(list, "frontend", 2, 0);
    expect(applicationQuestionsOf(next, "frontend").map((q) => [q.id, q.sort_order])).toEqual([["c", 0], ["a", 1], ["b", 2]]);
    expect(next.find((q) => q.id === "x")?.sort_order).toBe(5);
    expect(reorderPosition(list, "frontend", 0, -1)).toBe(list);
    expect(reorderPosition(list, "frontend", 2, 3)).toBe(list);
  });

  it("면접관 화면 미리보기는 지원서 상세처럼 공통과 포지션 질문을 등록 순서대로 섞는다", () => {
    const list = [iv("fe-2", "frontend", 3), iv("common-1", null, 1), iv("be-1", "backend", 2), iv("fe-1", "frontend", 0)];
    expect(interviewerViewOrder(list, "frontend").map((q) => q.id)).toEqual(["fe-1", "common-1", "fe-2"]);
    expect(interviewerViewOrder(list, "common").map((q) => q.id)).toEqual(["common-1"]);
    expect(interviewQuestionsOf(list, "frontend").map((q) => q.id)).toEqual(["fe-1", "fe-2"]);
  });

  it("시즌 값을 상단 제목으로 바꾼다", () => {
    expect(seasonLabel("2026-2")).toBe("2026 하반기 모집");
    expect(seasonLabel("2027-1")).toBe("2027 상반기 모집");
    expect(seasonLabel("특별")).toBe("특별 모집");
  });
});

describe("저장 상태", () => {
  it("성공하면 저장됨, 되돌리지 않는다", async () => {
    const rollback = vi.fn();
    await expect(saveWithRollback(async () => ({}), rollback)).resolves.toEqual({ status: "saved" });
    expect(rollback).not.toHaveBeenCalled();
  });

  it("오류 응답이면 실패 문구를 남기고 화면을 되돌린다", async () => {
    const rollback = vi.fn();
    await expect(saveWithRollback(async () => ({ error: "권한이 없어요" }), rollback)).resolves.toEqual({ status: "error", message: "권한이 없어요" });
    expect(rollback).toHaveBeenCalledOnce();
  });

  it("요청 자체가 실패해도(네트워크·403) 실패로 알리고 되돌린다", async () => {
    const rollback = vi.fn();
    await expect(saveWithRollback(() => Promise.reject(new Error("fetch failed")), rollback)).resolves.toEqual({ status: "error", message: "서버에 연결하지 못했어요" });
    expect(rollback).toHaveBeenCalledOnce();
  });
});

/** 순서 바꾸기용 Supabase 흉내: 현재 id 목록 조회와 행별 update 결과를 따로 준다. */
function reorderClient(currentIds: string[], updateResult: (id: string) => { data: { id: string }[] | null; error: { message: string } | null }) {
  const updates: { id: string; values: Record<string, unknown>; filters: [string, unknown][] }[] = [];
  const from = vi.fn(() => ({
    select: () => ({ eq: async () => ({ data: currentIds.map((id) => ({ id })), error: null }) }),
    update: (values: Record<string, unknown>) => {
      const entry = { id: "", values, filters: [] as [string, unknown][] };
      updates.push(entry);
      const builder = {
        eq(column: string, value: unknown) {
          entry.filters.push([column, value]);
          if (column === "id") entry.id = value as string;
          return builder;
        },
        select: async () => updateResult(entry.id),
      };
      return builder;
    },
  }));
  return { client: { from }, updates };
}

describe("reorderApplicationQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-id" } as never);
  });

  it("받은 순서대로 sort_order를 0부터 저장하고 /apply를 갱신한다", async () => {
    const { client, updates } = reorderClient(["a", "b", "c"], (id) => ({ data: [{ id }], error: null }));
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(reorderApplicationQuestions("frontend", ["c", "a", "b"])).resolves.toEqual({});
    expect(updates.map((u) => [u.id, u.values.sort_order])).toEqual([["c", 0], ["a", 1], ["b", 2]]);
    expect(updates.every((u) => u.filters.some(([column, value]) => column === "position" && value === "frontend"))).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/apply");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/questions");
  });

  it("화면이 본 목록과 DB 목록이 다르면 아무것도 바꾸지 않는다", async () => {
    const { client, updates } = reorderClient(["a", "b", "c", "d"], (id) => ({ data: [{ id }], error: null }));
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await reorderApplicationQuestions("frontend", ["c", "a", "b"]);
    expect(result.error).toContain("새로고침");
    expect(updates).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("중복·빈 목록·모르는 포지션은 DB에 접근하지 않는다", async () => {
    expect((await reorderApplicationQuestions("frontend", ["a", "a"])).error).toBeTruthy();
    expect((await reorderApplicationQuestions("frontend", [])).error).toBeTruthy();
    expect((await reorderApplicationQuestions("android" as never, ["a"])).error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("한 행이라도 저장되지 않으면(RLS 거부 0행) 성공으로 보고하지 않는다", async () => {
    const { client } = reorderClient(["a", "b"], (id) => ({ data: id === "b" ? [] : [{ id }], error: null }));
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(reorderApplicationQuestions("frontend", ["b", "a"])).resolves.toEqual({ error: "대상을 찾을 수 없어요" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("관리자가 아니면 DB에 접근하지 않는다", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(reorderApplicationQuestions("frontend", ["a"])).rejects.toThrow("NEXT_REDIRECT");
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("QuestionsManager 첫 화면", () => {
  it("프론트엔드 지원서 질문과 지원자 화면 미리보기를 /apply 순서대로 그린다", () => {
    const html = renderToStaticMarkup(createElement(QuestionsManager, {
      applicationQuestions: [app("q2", "frontend", 1, "지원 동기"), app("q1", "frontend", 0, "자기소개"), app("q9", "backend", 0, "백엔드 질문")],
      interviewQuestions: [iv("c1", null, 0), iv("f1", "frontend", 1)],
      presets: [],
      season: "2026-2",
      openPositions: ["frontend"],
      demo: true,
    }));
    expect(html).toContain("2026 하반기 모집");
    expect(html).toContain("프론트엔드 · 지원서 질문");
    expect(html).toContain("지원 2 · 면접 1");
    expect(html).toContain("둘러보기 · 저장되지 않아요");
    expect(html).not.toContain("백엔드 질문</button>");
    const preview = html.slice(html.indexOf("지원자 화면"));
    expect(preview.indexOf("1. 자기소개")).toBeGreaterThan(-1);
    expect(preview.indexOf("1. 자기소개")).toBeLessThan(preview.indexOf("2. 지원 동기"));
    expect(html).toContain('aria-label="1번 질문 아래로"');
  });
});
