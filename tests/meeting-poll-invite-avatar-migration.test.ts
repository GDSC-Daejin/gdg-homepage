import { describe, expect, it } from "vitest";
import { latestFunction } from "./migration-sql";

describe("초대 링크 참여자 아바타", () => {
  it("토큰 조회가 회원 프로필 사진 경로를 함께 돌려준다", async () => {
    const fn = await latestFunction("get_meeting_poll_by_token");

    expect(fn).toContain("left join profiles profile on profile.id = pa.user_id");
    expect(fn).toContain("'avatar_path', profile.avatar_path");
  });
});
