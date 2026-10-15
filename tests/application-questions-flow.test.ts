import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRecruitingSettings } from "@/lib/recruiting";
import { buildApplicationAnswerRows, getApplicationQuestionsFor } from "@/lib/application-questions";
import {
  createApplicationQuestion,
  deleteApplicationQuestion,
  updateApplicationQuestion,
} from "@/actions/application-question";
import { submitApplication } from "@/actions/application";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-id" }),
  getProfile: vi.fn(),
}));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/recruiting", () => ({
  getRecruitingSettings: vi.fn(),
  isRecruitingOpen: vi.fn(() => true),
}));
vi.mock("@/lib/email", () => ({ sendResultEmail: vi.fn(), sendApplicationOnboardingInviteEmail: vi.fn() }));
vi.mock("@/lib/application-questions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/application-questions")>()),
  getApplicationQuestionsFor: vi.fn(),
}));

/** application_questions 쿼리 체인 흉내 — 어떤 체인 메서드든 자기 자신을 돌려주고 await하면 result가 나온다. */
function chain(result: unknown) {
  const calls: { method: string; args: unknown[] }[] = [];
  const proxy: Record<string, unknown> = new Proxy({}, {
    get(_, prop: string) {
      if (prop === "then") return (resolve: (value: unknown) => void) => resolve(result);
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return proxy;
      };
    },
  });
  return { proxy, calls };
}

describe("buildApplicationAnswerRows", () => {
  const questions = [
    { id: "q-1", label: "자기소개" },
    { id: "q-2", label: "이 포지션에 지원한 이유" },
  ];

  it("현재 질문 순서대로 답변을 짝짓는다", () => {
    expect(buildApplicationAnswerRows(questions, { "q-2": "B", "q-1": "A" })).toEqual([
      { key: "q-1", label: "자기소개", answer: "A" },
      { key: "q-2", label: "이 포지션에 지원한 이유", answer: "B" },
    ]);
  });

  it("0119 이전 지원서의 intro·motivation·interest 답변을 이전 라벨로 보여준다", () => {
    const rows = buildApplicationAnswerRows(questions, { interest: "AI", intro: "안녕하세요", motivation: "성장" });
    expect(rows.map((row) => [row.label, row.answer])).toEqual([
      ["자기소개", "안녕하세요"],
      ["지원 동기", "성장"],
      ["관심 분야", "AI"],
    ]);
  });

  it("삭제되거나 프리셋으로 교체된 질문의 답변도 숨기지 않는다", () => {
    const rows = buildApplicationAnswerRows(questions, { "q-1": "A", "deleted-q": "지워진 질문의 답" });
    expect(rows).toEqual([
      { key: "q-1", label: "자기소개", answer: "A" },
      { key: "deleted-q", label: "삭제되거나 바뀐 질문", answer: "지워진 질문의 답" },
    ]);
  });
});

describe("지원 질문 관리 액션", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-id" } as never);
  });

  it("질문을 만들면 해당 포지션 맨 뒤에 넣고 /apply와 질문 관리 화면을 갱신한다", async () => {
    const last = chain({ data: { sort_order: 2 }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({ ...last.proxy, select: () => last.proxy, insert })),
    } as never);

    await expect(createApplicationQuestion("pm", "  기획 경험을 알려주세요  ")).resolves.toEqual({});
    expect(insert).toHaveBeenCalledWith({ position: "pm", label: "기획 경험을 알려주세요", sort_order: 3, created_by: "admin-id" });
    expect(revalidatePath).toHaveBeenCalledWith("/apply");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/questions");
  });

  it("허용하지 않는 포지션이나 빈 질문은 DB에 쓰지 않는다", async () => {
    const from = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    expect((await createApplicationQuestion("android" as never, "질문")).error).toBeTruthy();
    expect((await createApplicationQuestion("pm", "   ")).error).toBe("질문을 입력해주세요");
    expect(from).not.toHaveBeenCalled();
  });

  it("관리자가 아니면 requireAdmin에서 막혀 DB에 접근하지 않는다", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(updateApplicationQuestion("q-1", "수정")).rejects.toThrow("NEXT_REDIRECT");
    await expect(deleteApplicationQuestion("q-1")).rejects.toThrow("NEXT_REDIRECT");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("수정·삭제가 0행에 적용되면(RLS 거부·이미 삭제) 성공으로 보고하지 않는다", async () => {
    const empty = chain({ data: [], error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => empty.proxy } as never);

    await expect(updateApplicationQuestion("q-1", "수정")).resolves.toEqual({ error: "대상을 찾을 수 없어요" });
    await expect(deleteApplicationQuestion("q-1")).resolves.toEqual({ error: "대상을 찾을 수 없어요" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("수정·삭제가 반영되면 /apply를 갱신한다", async () => {
    const updated = chain({ data: [{ id: "q-1" }], error: null });
    vi.mocked(createClient).mockResolvedValue({ from: () => updated.proxy } as never);

    await expect(updateApplicationQuestion("q-1", "새 질문")).resolves.toEqual({});
    await expect(deleteApplicationQuestion("q-1")).resolves.toEqual({});
    expect(updated.calls.filter((call) => call.method === "eq")).toEqual([
      { method: "eq", args: ["id", "q-1"] },
      { method: "eq", args: ["id", "q-1"] },
    ]);
    expect(vi.mocked(revalidatePath).mock.calls.filter(([path]) => path === "/apply")).toHaveLength(2);
  });

  it("면접 질문 액션도 묶음 화면(/admin/questions)을 갱신한다", async () => {
    const source = await readFile("src/actions/interview-question.ts", "utf8");
    expect(source.match(/revalidatePath\("\/admin\/questions"\)/g)).toHaveLength(3);
  });
});

describe("submitApplication 포지션별 질문", () => {
  const formBase = {
    applicant_name: "홍길동",
    student_no: "20261234",
    major: "컴퓨터공학과",
    phone: "010-1234-5678",
    email: "applicant@example.com",
  };

  function form(values: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries({ ...formBase, ...values })) data.set(key, value);
    return data;
  }

  let insert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRecruitingSettings).mockResolvedValue({
      season: "2026-2",
      is_open: true,
      open_positions: ["pm", "frontend"],
      apply_start: null,
      apply_end: null,
    } as never);
    vi.mocked(getApplicationQuestionsFor).mockResolvedValue([
      { id: "pm-q1", position: "pm", label: "기획 경험", sort_order: 0, created_by: null, created_at: "", updated_at: "" },
      { id: "pm-q2", position: "pm", label: "지원 동기", sort_order: 1, created_by: null, created_at: "", updated_at: "" },
    ]);
    insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: vi.fn(() => ({ insert })),
    } as never);
  });

  it("선택한 포지션의 질문 id를 키로 답변을 저장한다", async () => {
    await expect(submitApplication(form({ position: "pm", "pm-q1": " 동아리 운영 ", "pm-q2": "성장" }))).resolves.toEqual({});
    expect(getApplicationQuestionsFor).toHaveBeenCalledWith("pm");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      position: "pm",
      answers: { "pm-q1": "동아리 운영", "pm-q2": "성장" },
    }));
  });

  it("질문 하나라도 비면 저장하지 않는다", async () => {
    await expect(submitApplication(form({ position: "pm", "pm-q1": "답" }))).resolves.toEqual({ error: "모든 항목을 입력해주세요" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("알 수 없는 포지션은 질문을 조회하기 전에 거절한다", async () => {
    const result = await submitApplication(form({ position: "android" }));
    expect(result.error).toBe("지원 포지션을 선택해주세요");
    expect(getApplicationQuestionsFor).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("모집하지 않는 포지션은 저장하지 않는다", async () => {
    vi.mocked(getApplicationQuestionsFor).mockResolvedValue([
      { id: "be-q1", position: "backend", label: "q", sort_order: 0, created_by: null, created_at: "", updated_at: "" },
    ]);
    await expect(submitApplication(form({ position: "backend", "be-q1": "답" }))).resolves.toEqual({ error: "지금은 모집하지 않는 포지션이에요" });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("지원 질문 읽기 폴백", () => {
  it("0119 미적용 등으로 질문 조회가 실패하면 기존 intro·motivation·interest 키로 돌아간다", async () => {
    const actual = await vi.importActual<typeof import("@/lib/application-questions")>("@/lib/application-questions");
    const failing = chain({ data: null, error: { code: "42P01" } });
    vi.mocked(createClient).mockResolvedValue({ from: () => failing.proxy } as never);
    const questions = await actual.getApplicationQuestionsFor("pm");
    expect(questions.map((question) => question.id)).toEqual(["intro", "motivation", "interest"]);
    expect(questions.every((question) => question.position === "pm")).toBe(true);
  });
});
