import { describe, expect, it } from "vitest";
import { forgetAvatarUrl, readAvatarUrl, writeAvatarUrl } from "@/components/useAvatarUrl";

const PATH = "avatars/demo.png";

describe("아바타 서명 URL 캐시", () => {
  it("한 번 받은 URL을 그대로 돌려준다", () => {
    writeAvatarUrl(PATH, "https://signed/1");
    expect(readAvatarUrl(PATH)).toBe("https://signed/1");
    forgetAvatarUrl(PATH);
  });

  it("경로가 없으면 캐시를 보지 않는다", () => {
    expect(readAvatarUrl(null)).toBeUndefined();
    expect(readAvatarUrl(undefined)).toBeUndefined();
  });

  it("만료된 URL은 버린다 — 깨진 이미지를 물려주지 않는다", () => {
    const now = 1_000_000;
    writeAvatarUrl(PATH, "https://signed/2", now);
    // 1시간에서 여유분 5분을 뺀 55분이 수명이다.
    expect(readAvatarUrl(PATH, now + 54 * 60 * 1000)).toBe("https://signed/2");
    expect(readAvatarUrl(PATH, now + 56 * 60 * 1000)).toBeUndefined();
    expect(readAvatarUrl(PATH, now)).toBeUndefined();
  });

  it("지우면 다시 없는 상태가 된다", () => {
    writeAvatarUrl(PATH, "https://signed/3");
    forgetAvatarUrl(PATH);
    expect(readAvatarUrl(PATH)).toBeUndefined();
  });
});
