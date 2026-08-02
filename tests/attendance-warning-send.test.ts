import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceReads } from "@/lib/community/types";
import type { Profile } from "@/lib/types";

const postMessage = vi.fn();
vi.mock("@/lib/slack/api", () => ({ postMessage: (...args: unknown[]) => postMessage(...args) }));

const { sendAttendanceWarnings } = await import("@/lib/attendance-warning");

/** u1은 4번 확정 중 1번 출석(25%) → 경고 대상 */
function warningReads(): AttendanceReads {
  return {
    activeMembers: async () => [{ id: "u1", name: "낮은출석" } as Profile],
    pastEventIds: async () => ["e1", "e2", "e3", "e4"],
    confirmedRegistrations: async () =>
      ["e1", "e2", "e3", "e4"].map((event_id) => ({ user_id: "u1", event_id })),
    attendances: async () => [{ user_id: "u1", event_id: "e1" }],
  };
}

function emptyReads(): AttendanceReads {
  return {
    activeMembers: async () => [],
    pastEventIds: async () => [],
    confirmedRegistrations: async () => [],
    attendances: async () => [],
  };
}

/** insert 결과만 흉내 내는 최소 클라이언트. deleted에 삭제된 날짜가 쌓인다. */
function fakeClient(insertError?: { code?: string }) {
  const deleted: string[] = [];
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (!insertError) inserted.push(row);
        return { error: insertError ?? null };
      },
      delete: () => ({
        eq: async (_col: string, value: string) => {
          deleted.push(value);
          return { error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, deleted, inserted };
}

afterEach(() => {
  postMessage.mockReset();
  delete process.env.SLACK_ADMIN_CHANNEL_ID;
  delete process.env.SLACK_JARVIS_BOT_TOKEN;
});

function configured() {
  process.env.SLACK_ADMIN_CHANNEL_ID = "C_ADMIN";
  process.env.SLACK_JARVIS_BOT_TOKEN = "xoxb-jarvis";
}

describe("sendAttendanceWarnings", () => {
  it("운영진 채널로 Jarvis 토큰으로만 보낸다 (웹훅·꼬북봇 아님)", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: true, ts: "1" });
    const { client, inserted } = fakeClient();

    expect(await sendAttendanceWarnings(warningReads(), client)).toEqual({ count: 1 });
    expect(postMessage).toHaveBeenCalledWith({
      channel: "C_ADMIN",
      botToken: "xoxb-jarvis",
      text: "[출석 경고] 출석률 50% 미만 회원 1명\n- 낮은출석 (25%)",
    });
    // 보내기 전에 오늘 자리를 예약했다
    expect(inserted).toHaveLength(1);
  });

  it("운영진 봇 토큰이 없으면 꼬북봇으로 대신 보내지 않는다", async () => {
    process.env.SLACK_ADMIN_CHANNEL_ID = "C_ADMIN"; // 토큰만 비운다
    const { client, inserted } = fakeClient();

    const result = await sendAttendanceWarnings(warningReads(), client);

    expect(result.error).toContain("SLACK_JARVIS_BOT_TOKEN");
    expect(inserted).toHaveLength(0);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("오늘 이미 보냈으면(유일 제약 위반) 다시 보내지 않는다", async () => {
    configured();
    const { client } = fakeClient({ code: "23505" });

    expect(await sendAttendanceWarnings(warningReads(), client)).toEqual({
      count: 0,
      skipped: true,
    });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("전송이 실패하면 예약을 지워 다시 시도할 수 있게 한다", async () => {
    configured();
    postMessage.mockResolvedValue({ ok: false, error: "not_in_channel" });
    const { client, deleted } = fakeClient();

    const result = await sendAttendanceWarnings(warningReads(), client);

    expect(result.error).toContain("not_in_channel");
    expect(deleted).toHaveLength(1);
  });

  it("채널이 설정되지 않으면 예약도 발송도 하지 않는다", async () => {
    const { client, inserted } = fakeClient();

    const result = await sendAttendanceWarnings(warningReads(), client);

    expect(result.error).toContain("SLACK_ADMIN_CHANNEL_ID");
    expect(inserted).toHaveLength(0);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("대상이 없으면 아무 것도 하지 않는다", async () => {
    configured();
    const { client, inserted } = fakeClient();

    expect(await sendAttendanceWarnings(emptyReads(), client)).toEqual({ count: 0 });
    expect(inserted).toHaveLength(0);
    expect(postMessage).not.toHaveBeenCalled();
  });
});
