import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  AVATAR_MAX_BYTES,
  avatarPath,
  isOwnAvatarPath,
  validateAvatarFile,
} from "@/lib/avatar";

describe("프로필 사진", () => {
  it("PNG/JPEG/WebP 5MB 이하만 허용한다", () => {
    expect(
      validateAvatarFile({ type: "image/webp", size: AVATAR_MAX_BYTES }),
    ).toBeUndefined();
    expect(validateAvatarFile({ type: "image/gif", size: 1 })).toBe(
      "PNG, JPEG, WebP 이미지만 올릴 수 있어요",
    );
    expect(
      validateAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES + 1 }),
    ).toBe("프로필 사진은 5MB 이하만 올릴 수 있어요");
  });

  it("사용자별로 하나의 고정 경로를 만든다", () => {
    expect(avatarPath("user-1")).toBe("user-1/avatar");
  });

  it("자신의 고정 경로만 프로필에 저장할 수 있다", () => {
    expect(isOwnAvatarPath("user-1", "user-1/avatar")).toBe(true);
    expect(isOwnAvatarPath("user-1", "user-2/avatar")).toBe(false);
    expect(isOwnAvatarPath("user-1", "user-1/other")).toBe(false);
  });

  it("DB도 사용자 외의 사진 경로를 거부한다", async () => {
    const migration = await readFile("supabase/migrations/0028_profile_avatars.sql", "utf8");
    expect(migration).toContain(
      "check (avatar_path is null or avatar_path = id::text || '/avatar')",
    );
  });
});
