import { describe, expect, it } from "vitest";
import { buildSlackMessage, classifyCommit } from "../scripts/notify-slack.mjs";

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
