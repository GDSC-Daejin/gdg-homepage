import type { Coords } from "@/lib/geocode";

export type MapSource =
  | { kind: "coords"; coords: Coords }
  | { kind: "address"; address: string }
  | null;

export function resolveMapSource(
  coords: Coords | null | undefined,
  address: string | null | undefined,
): MapSource {
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return { kind: "coords", coords };
  }
  const trimmed = address?.trim();
  if (trimmed) return { kind: "address", address: trimmed };
  return null;
}
