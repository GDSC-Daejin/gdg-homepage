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

  it("승인 대기 안내를 온보딩 화면 하나로 합친다", async () => {
    const [page, pending, auth] = await Promise.all([
      readFile("src/app/onboarding/page.tsx", "utf8"),
      readFile("src/app/pending/page.tsx", "utf8"),
      readFile("src/lib/auth.ts", "utf8"),
    ]);

    // 승인 게이트는 더 이상 별도 화면으로 보내지 않는다.
    expect(auth).toContain('redirect("/onboarding")');
    expect(auth).not.toContain('redirect("/pending")');
    expect(pending).toContain('redirect("/onboarding")');
    // 같은 화면이 제출 전/후를 나눠 그린다.
    expect(page).toContain('profile.student_no !== ""');
    expect(page).toContain("승인 대기 중");
  });

  it("제출한 뒤에도 입력한 내용을 고칠 수 있다", async () => {
    const [page, form] = await Promise.all([
      readFile("src/app/onboarding/page.tsx", "utf8"),
      readFile("src/app/onboarding/OnboardingForm.tsx", "utf8"),
    ]);

    // 제출했다고 화면 밖으로 튕기면 오타를 고칠 방법이 없다.
    expect(page).not.toContain('if (profile.student_no !== "") redirect("/")');
    expect(form).toContain("defaultValue={profile.student_no}");
    expect(form).toContain("defaultValue={profile.phone}");
    expect(form).toContain('submitted ? "수정 내용 저장"');
  });

  it("온보딩을 안 끝낸 계정은 승인 대기 목록에 올리지 않는다", async () => {
    const members = await readFile("src/app/admin/members/page.tsx", "utf8");

    expect(members).toContain('.is("approved_at", null).neq("student_no", "")');
    expect(members).toContain('m.student_no !== ""');
  });
});
