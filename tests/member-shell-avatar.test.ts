import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("회원 사이드바 프로필 사진", () => {
  it("공용 아바타에 현재 프로필 사진 경로를 전달한다", async () => {
    const shell = await readFile("src/app/(member)/MemberShell.tsx", "utf8");

    expect(shell).toContain('import { Avatar } from "@/components/Avatar"');
    expect(shell).toContain("avatarPath={profile.avatar_path}");
  });
});
