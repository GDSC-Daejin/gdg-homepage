import { describe, expect, it } from "vitest";
import {
  buildSlackMessage,
  classifyCommit,
  kstDayStart,
  pickTodayParentTs,
} from "../scripts/notify-slack.mjs";

describe("classifyCommit", () => {
  it("conventional 접두사를 버킷으로 분류하고 접두사를 제거한다", () => {
    expect(classifyCommit("feat: 홈 대시보드에 배너 추가")).toEqual({
      bucket: "feat",
      description: "홈 대시보드에 배너 추가",
    });
    expect(classifyCommit("fix(auth): 로그인 오류")).toEqual({
      bucket: "fix",
      description: "로그인 오류",
    });
  });

  it("선두 emoji를 버킷으로 분류한다", () => {
    expect(classifyCommit("📝 공지 아코디언 설계 추가")).toEqual({
      bucket: "docs",
      description: "공지 아코디언 설계 추가",
    });
  });

  it("refactor/chore 등은 내부 개선으로 묶는다", () => {
    expect(classifyCommit("refactor: 함수 추출")?.bucket).toBe("internal");
    expect(classifyCommit("chore: deps 업데이트")?.bucket).toBe("internal");
  });

  it("알 수 없는 형식은 기타로 분류한다", () => {
    expect(classifyCommit("월간 포인트 합산 로직 수정")).toEqual({
      bucket: "other",
      description: "월간 포인트 합산 로직 수정",
    });
  });

  it("머지 커밋과 빈 메시지는 제외한다", () => {
    expect(classifyCommit("Merge branch 'main' into dev")).toBeNull();
    expect(classifyCommit("")).toBeNull();
  });
});

describe("buildSlackMessage", () => {
  it("버킷 순서대로 그룹핑하고 건수/링크를 넣는다", () => {
    const commits = [
      { message: "feat: 미응답 설문 배너 추가" },
      { message: "📝 공지 아코디언 설계 추가" },
      { message: "feat: 정원 승급 시 Slack 알림" },
      { message: "refactor: 포인트 합산 함수 추출" },
      { message: "Merge branch 'main' into dev" },
    ];
    const text = buildSlackMessage(commits, "https://example.com/compare");

    expect(text).toContain("🚀 dev 업데이트 (4건)");
    // ✨ 새 기능이 📝 문서보다 먼저 나온다
    expect(text!.indexOf("✨ 새 기능")).toBeLessThan(text!.indexOf("📝 문서"));
    // 내부 개선은 맨 뒤
    expect(text!.indexOf("🔧 내부 개선")).toBeGreaterThan(
      text!.indexOf("📝 문서"),
    );
    expect(text).toContain("• 미응답 설문 배너 추가");
    expect(text).toContain("▸ 자세히 보기: https://example.com/compare");
  });

  it("알릴 커밋이 없으면 null을 반환한다", () => {
    expect(buildSlackMessage([{ message: "Merge x" }], "url")).toBeNull();
    expect(buildSlackMessage([], "url")).toBeNull();
  });
});

describe("pickTodayParentTs", () => {
  const parent = (ts: string, over: Record<string, unknown> = {}) => ({
    ts,
    bot_id: "B1",
    text: "🚀 dev 업데이트 (2건)\n...",
    ...over,
  });

  it("그날 첫 글의 ts를 고른다 (history는 최신순)", () => {
    expect(pickTodayParentTs([parent("300"), parent("200"), parent("100")])).toBe("100");
  });

  it("답글이 달려 thread_ts가 채워진 부모도 부모로 인정한다", () => {
    // 부모 글은 답글이 생기면 thread_ts === ts 가 붙는다. 이걸 걸러내면 매일 새 글이 여러 개 생긴다.
    expect(pickTodayParentTs([parent("100", { thread_ts: "100" })])).toBe("100");
  });

  it("스레드 답글·사람 글·다른 봇 글은 부모가 아니다", () => {
    const messages = [
      parent("300", { thread_ts: "100" }), // 다른 글에 달린 답글
      { ts: "250", text: "🚀 dev 업데이트 (1건)" }, // bot_id 없음 = 사람
      { ts: "240", bot_id: "B1", text: "📢 새 공지가 등록됐어요" }, // 다른 알림
    ];
    expect(pickTodayParentTs(messages)).toBeNull();
  });

  it("오늘 글이 없으면 null (새 글로 올린다)", () => {
    expect(pickTodayParentTs([])).toBeNull();
    expect(pickTodayParentTs(undefined)).toBeNull();
  });
});

describe("kstDayStart", () => {
  it("KST 자정을 초 단위 epoch로 준다", () => {
    // 2026-07-26 08:00 KST → 그날 0시(= 2026-07-25T15:00Z)
    const start = kstDayStart(new Date("2026-07-25T23:00:00.000Z"));
    expect(new Date(start * 1000).toISOString()).toBe("2026-07-25T15:00:00.000Z");
  });
});
