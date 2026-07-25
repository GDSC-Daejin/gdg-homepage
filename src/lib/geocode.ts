// 구 호스트(naveropenapi.apigw.ntruss.com)는 401 "Permission Denied" — 신규 Maps 호스트만 동작한다
const ENDPOINT = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";

export interface Coords {
  lat: number;
  lng: number;
}

// 네이버 Geocoding 응답에서 첫 좌표 추출 (테스트용으로 분리)
export function parseGeocode(data: unknown): Coords | null {
  const first = (data as { addresses?: { x?: string; y?: string }[] })
    ?.addresses?.[0];
  if (!first?.x || !first?.y) return null;
  const lat = Number(first.y);
  const lng = Number(first.x);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export type GeocodeResult =
  | { coords: Coords }
  | { coords: null; reason: string };

// 주소 → 좌표. 실패 시 사람이 읽을 수 있는 사유를 함께 돌려준다
export async function geocodeWithReason(address: string): Promise<GeocodeResult> {
  const id = process.env.NCP_MAP_API_KEY_ID;
  const key = process.env.NCP_MAP_API_KEY;
  if (!id || !key) {
    return { coords: null, reason: "NCP_MAP_API_KEY_ID/NCP_MAP_API_KEY 미설정" };
  }
  if (!address.trim()) return { coords: null, reason: "주소 없음" };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(address)}`, {
      headers: {
        "x-ncp-apigw-api-key-id": id,
        "x-ncp-apigw-api-key": key,
        Accept: "application/json",
      },
    });
  } catch (e) {
    return { coords: null, reason: `네트워크 오류: ${(e as Error).message}` };
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    return { coords: null, reason: `네이버 API ${res.status} — ${body}` };
  }

  const coords = parseGeocode(await res.json());
  if (!coords) return { coords: null, reason: "검색 결과 없음 (주소 표기 확인)" };
  return { coords };
}

// 주소 → 좌표. 키 미설정·주소 공백·실패 시 null (지도 없이 저장 허용)
export async function geocodeAddress(address: string): Promise<Coords | null> {
  const result = await geocodeWithReason(address);
  // 주소를 안 넣은 건 정상 경로라 로그 안 남긴다
  if (!result.coords && address.trim()) {
    console.warn(`[geocode] "${address}" 변환 실패 — ${result.reason}`);
  }
  return result.coords;
}
