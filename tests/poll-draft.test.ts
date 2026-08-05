import { describe, expect, it } from "vitest";
import { addPollDraftPerson, setPollDateSelection } from "@/app/schedule/new/poll-draft";

describe("setPollDateSelection", () => {
  it("드래그로 지난 날짜를 같은 동작으로 선택한다", () => {
    expect(
      setPollDateSelection(["2026-08-04"], ["2026-08-05", "2026-08-06"], true),
    ).toEqual(["2026-08-04", "2026-08-05", "2026-08-06"]);
  });

  it("선택된 날짜에서 시작하면 지난 날짜를 모두 해제한다", () => {
    expect(
      setPollDateSelection(
        ["2026-08-04", "2026-08-05", "2026-08-06"],
        ["2026-08-05", "2026-08-06"],
        false,
      ),
    ).toEqual(["2026-08-04"]);
  });
});

describe("addPollDraftPerson", () => {
  it("활성 회원 목록에 없는 이름은 참여자로 추가하지 않는다", () => {
    expect(addPollDraftPerson([], "외부인", [{ id: "member-1", name: "회원", avatarPath: null }])).toEqual([]);
  });

  it("회원의 프로필 이미지를 참여자 초대에 함께 담는다", () => {
    expect(addPollDraftPerson([], "회원", [{ id: "member-1", name: "회원", avatarPath: "avatars/member-1.png" }]))
      .toEqual([expect.objectContaining({ avatarPath: "avatars/member-1.png" })]);
  });
});
