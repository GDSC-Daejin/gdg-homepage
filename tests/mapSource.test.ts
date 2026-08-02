import { describe, it, expect } from "vitest";
import { resolveMapSource } from "@/lib/mapSource";

describe("resolveMapSource", () => {
  it("저장 좌표가 있으면 좌표를 우선한다", () => {
    expect(resolveMapSource({ lat: 37.5, lng: 127.0 }, "어떤 주소")).toEqual({
      kind: "coords",
      coords: { lat: 37.5, lng: 127.0 },
    });
  });

  it("좌표가 없으면 주소로 폴백한다", () => {
    expect(resolveMapSource(null, "서울특별시 도봉구 마들로11길 75")).toEqual({
      kind: "address",
      address: "서울특별시 도봉구 마들로11길 75",
    });
  });

  it("좌표도 주소도 없으면 null", () => {
    expect(resolveMapSource(null, "")).toBeNull();
    expect(resolveMapSource(null, "   ")).toBeNull();
    expect(resolveMapSource(undefined, undefined)).toBeNull();
  });

  it("좌표 값이 NaN이면 좌표를 무시하고 주소로 폴백한다", () => {
    expect(resolveMapSource({ lat: NaN, lng: 127 }, "서울")).toEqual({
      kind: "address",
      address: "서울",
    });
  });
});
