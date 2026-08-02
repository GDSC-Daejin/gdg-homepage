import { describe, expect, it } from "vitest";
import { composeNoticeBody, parseNoticeBody } from "@/lib/notice-body";

describe("notice-body", () => {
  it("일정·장소·준비물을 본문 앞 머리말로 붙인다", () => {
    expect(
      composeNoticeBody({
        schedule: "2026-08-12T19:00",
        place: "스타트업파크",
        supplies: "노트북, 충전기",
        body: "많이 와주세요.",
      }),
    ).toBe(
      "🗓 일정: 2026-08-12 19:00\n📍 장소: 스타트업파크\n🎒 준비물: 노트북, 충전기\n\n많이 와주세요.",
    );
  });

  it("비어 있는 필드는 줄을 만들지 않는다", () => {
    expect(
      composeNoticeBody({ schedule: "", place: "", supplies: "", body: "본문만" }),
    ).toBe("본문만");
    expect(
      composeNoticeBody({ schedule: "", place: "온라인", supplies: "", body: "" }),
    ).toBe("📍 장소: 온라인");
  });

  it("compose → parse 왕복에서 값이 그대로 돌아온다", () => {
    const details = {
      schedule: "2026-08-12T19:00",
      place: "스타트업파크",
      supplies: "노트북",
      body: "많이 와주세요.\n\n문의는 슬랙으로.",
    };
    expect(parseNoticeBody(composeNoticeBody(details))).toEqual(details);
  });

  it("머리말 없는 옛 공지는 전부 본문으로 읽는다", () => {
    expect(parseNoticeBody("그냥 줄글 공지\n둘째 줄")).toEqual({
      schedule: "",
      place: "",
      supplies: "",
      body: "그냥 줄글 공지\n둘째 줄",
    });
  });

  it("폼으로 못 담는 자유형 일정은 본문에 그대로 남긴다", () => {
    const raw = "🗓 일정: 매주 화 19:00\n📍 장소: 스타트업파크\n\n본문";
    expect(parseNoticeBody(raw)).toEqual({
      schedule: "",
      place: "",
      supplies: "",
      body: raw,
    });
  });
});
