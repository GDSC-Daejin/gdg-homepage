const ENDPOINT =
  "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode";

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

// 주소 → 좌표. 키 미설정·주소 공백·실패 시 null (지도 없이 저장 허용)
export async function geocodeAddress(address: string): Promise<Coords | null> {
  const id = process.env.NCP_MAP_API_KEY_ID;
  const key = process.env.NCP_MAP_API_KEY;
  if (!id || !key || !address.trim()) return null;

  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(address)}`, {
    headers: {
      "x-ncp-apigw-api-key-id": id,
      "x-ncp-apigw-api-key": key,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  return parseGeocode(await res.json());
}
