import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("온보딩 흐름", () => {
  it("온보딩은 멤버 셸 밖에 있고, 미등록 멤버는 온보딩으로 보낸다", async () => {
    const [layout, form] = await Promise.all([
      readFile("src/app/(member)/layout.tsx", "utf8"),
      readFile("src/app/onboarding/OnboardingForm.tsx", "utf8"),
    ]);

    expect(layout).toContain("requireProfile");
    expect(form).toContain("interests.length > 0");
    expect(form).toContain("disabled={pending || !isComplete}");
  });
});
