import { describe, it, expect } from "vitest";
import { parseGeocode } from "@/lib/geocode";

describe("parseGeocode", () => {
  it("첫 주소의 x(경도)/y(위도)를 좌표로 변환", () => {
    const data = { addresses: [{ x: "127.105399", y: "37.3595704" }] };
    expect(parseGeocode(data)).toEqual({ lat: 37.3595704, lng: 127.105399 });
  });

  it("결과 없으면 null", () => {
    expect(parseGeocode({ addresses: [] })).toBeNull();
    expect(parseGeocode({})).toBeNull();
    expect(parseGeocode(null)).toBeNull();
  });
});
