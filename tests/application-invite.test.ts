import { describe, expect, it } from "vitest";
import {
  applicationInviteUrl,
  createApplicationInviteToken,
  hashApplicationInviteToken,
} from "@/lib/application-invite";

describe("합격자 가입 초대 토큰", () => {
  it("원문 토큰과 해시를 분리하고 URL을 인코딩한다", () => {
    const token = createApplicationInviteToken();
    const hash = hashApplicationInviteToken(token);

    expect(token).toHaveLength(64);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(applicationInviteUrl(token)).toContain("/onboarding/invite?token=");
  });
});
