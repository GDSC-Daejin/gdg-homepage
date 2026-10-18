import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventNoticeDraftInput } from "@/lib/event-notice-draft";

const postMessage = vi.fn();
vi.mock("@/lib/slack/api", () => ({ postMessage: (...args: unknown[]) => postMessage(...args) }));

const { buildEventNoticeDraft, buildEventNoticeDraftMessage } = await import("@/lib/event-notice-draft");
const { sendEventNoticeDraft } = await import("@/lib/event-notice-draft-send");

const base: EventNoticeDraftInput = {
  type: "session",
  title: "10월 정기세션",
  description: "새 멤버와 기존 멤버가 서로 알아가는 자리예요.",
  eventDate: "2026-10-30",
  startTime: "16:00",
  endTime: null,
  location: "서울청년센터 도봉 1층 프로그램실",
  address: "창동역 1번 출구 바로 앞",
  speaker: "홍길동",
};

afterEach(() => {
  postMessage.mockReset();
  vi.unstubAllEnvs();
});

describe("공지 초안 본문", () => {
  it("정기세션 예시", () => {
    const draft = buildEventNoticeDraft(base);
    console.log(draft);
    expect(draft).toContain("@channel 10월 정기세션 안내드립니다!");
    expect(draft).toContain("[인사말: 시기에 맞게 수정]");
    expect(draft).toContain("* 일정: 10/30(금)");
    expect(draft).toContain("* 시간: 오후 4시부터");
    expect(draft).toContain("* 장소: 서울청년센터 도봉 1층 프로그램실");
    expect(draft).toContain("* 위치: 창동역 1번 출구 바로 앞");
    expect(draft).toContain("* 발표자: 홍길동");
    expect(draft).toContain(base.description);
  });

  it("유형마다 인사말·마무리가 다르다", () => {
    const types = ["session", "study", "mogakco", "party"] as const;
    const drafts = types.map((type) => buildEventNoticeDraft({ ...base, type }));
    expect(new Set(drafts).size).toBe(4);
    expect(drafts[1]).toContain("함께할 분을 모집합니다!");
    expect(drafts[2]).toContain("같이 모여 코딩해요!");
    expect(drafts[3]).toContain("초대합니다!");
    expect(drafts[3]).toContain("파티 · 10월 정기세션");
  });

  it("시간이 미정이면 추후 안내, 시작·종료가 모두 있으면 범위로 쓴다", () => {
    expect(buildEventNoticeDraft({ ...base, startTime: null, endTime: null })).toContain("* 시간: 추후 안내");
    expect(buildEventNoticeDraft({ ...base, startTime: null, endTime: "18:00" })).toContain("* 시간: 추후 안내");
    expect(buildEventNoticeDraft({ ...base, startTime: "16:30", endTime: "18:00" })).toContain(
      "* 시간: 오후 4시 30분 ~ 오후 6시",
    );
    expect(buildEventNoticeDraft({ ...base, eventDate: null })).toContain("* 일정: 추후 안내");
  });

  it("장소·발표자·설명이 비면 그 줄을 뺀다", () => {
    const draft = buildEventNoticeDraft({ ...base, location: "", address: "", speaker: " ", description: "" });
    expect(draft).not.toContain("* 장소");
    expect(draft).not.toContain("* 위치");
    expect(draft).not.toContain("* 발표자");
    expect(draft).not.toContain(base.description);
    expect(draft).not.toMatch(/\n\n\n/);
  });
});

describe("슬랙 메시지", () => {
  it("@channel이 특수 멘션이 되지 않고 코드 블록 안에 들어간다", () => {
    const text = buildEventNoticeDraftMessage(base, "https://example.com/admin/events/e1");
    expect(text).not.toContain("<!channel>");
    expect(text).not.toContain("<!here>");
    expect(text).toContain("📝 *10월 정기세션* 공지 초안이에요.");
    expect(text).toContain("<https://example.com/admin/events/e1|");
    expect(text).toMatch(/```\n@channel 10월 정기세션 안내드립니다!/);
    expect(text.endsWith("\n```")).toBe(true);
  });

  it("제목에 꺾쇠·코드 블록 표시가 있어도 멘션이나 블록이 깨지지 않는다", () => {
    const text = buildEventNoticeDraftMessage({ ...base, title: "<!channel> ``` 테스트" }, "https://example.com/x");
    expect(text).not.toContain("<!channel>");
    expect(text).toContain("&lt;!channel&gt;");
    expect(text.match(/```/g)).toHaveLength(2);
  });
});

describe("초안 발송", () => {
  it("Jarvis 토큰으로 admin 채널에 보낸다", async () => {
    vi.stubEnv("SLACK_JARVIS_BOT_TOKEN", "xoxb-test");
    vi.stubEnv("SLACK_ADMIN_CHANNEL_ID", "CADMIN");
    postMessage.mockResolvedValue({ ok: true, ts: "1" });

    expect(await sendEventNoticeDraft("e1", base)).toBeUndefined();
    expect(postMessage.mock.calls[0][0]).toMatchObject({ channel: "CADMIN", botToken: "xoxb-test" });
  });

  it("설정이 없거나 슬랙이 실패해도 던지지 않고 사유를 돌려준다", async () => {
    vi.stubEnv("SLACK_JARVIS_BOT_TOKEN", "");
    expect(await sendEventNoticeDraft("e1", base)).toContain("슬랙 설정이 없어");
    expect(postMessage).not.toHaveBeenCalled();

    vi.stubEnv("SLACK_JARVIS_BOT_TOKEN", "xoxb-test");
    vi.stubEnv("SLACK_ADMIN_CHANNEL_ID", "CADMIN");
    postMessage.mockResolvedValueOnce({ ok: false, error: "not_in_channel" });
    expect(await sendEventNoticeDraft("e1", base)).toContain("not_in_channel");
    postMessage.mockRejectedValueOnce(new Error("boom"));
    expect(await sendEventNoticeDraft("e1", base)).toContain("보내지 못했어요");
  });
});
