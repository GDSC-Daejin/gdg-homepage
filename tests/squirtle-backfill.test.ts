import { describe, expect, it } from "vitest";
import { matchSlackUsers } from "@/lib/squirtle/backfill";

describe("슬랙 계정 매칭", () => {
  it("이메일이 같으면 짝지어준다", () => {
    expect(matchSlackUsers(new Map([["U1", "a@gmail.com"]]), [{ id: "p1", email: "a@gmail.com" }])).toEqual([{ id: "p1", slack_user_id: "U1" }]);
  });
  it("대소문자를 무시한다", () => {
    expect(matchSlackUsers(new Map([["U1", "a@gmail.com"]]), [{ id: "p1", email: "A@Gmail.COM" }])).toHaveLength(1);
  });
  it("짝이 없는 회원은 건너뛴다", () => {
    expect(matchSlackUsers(new Map([["U1", "a@gmail.com"]]), [{ id: "p2", email: "b@gmail.com" }])).toEqual([]);
  });
  it("이메일이 빈 회원은 건너뛴다", () => {
    expect(matchSlackUsers(new Map([["U1", "a@gmail.com"]]), [{ id: "p1", email: "" }])).toEqual([]);
  });
  it("같은 이메일이 여러 회원에 있으면 아무도 매칭하지 않는다", () => {
    expect(matchSlackUsers(new Map([["U1", "a@gmail.com"]]), [{ id: "p1", email: "a@gmail.com" }, { id: "p2", email: "a@gmail.com" }])).toEqual([]);
  });
});
