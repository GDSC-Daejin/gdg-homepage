"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveMapSource } from "@/lib/mapSource";
import type { Coords } from "@/lib/geocode";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    naver?: any;
  }
}

const SCRIPT_ID = "naver-maps-sdk";

// maps.js(+geocoder) 로드 후 콜백. cleanup 함수 반환.
function loadSdk(keyId: string, onReady: () => void): () => void {
  function onLoad() {
    const maps = window.naver?.maps;
    if (!maps) return;
    if (maps.Service) {
      onReady();
      return;
    }
    maps.onJSContentLoaded = onReady;
  }

  if (window.naver?.maps) {
    onLoad();
    return () => {};
  }
  let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${keyId}&submodules=geocoder`;
    document.head.appendChild(script);
  }
  script.addEventListener("load", onLoad);
  return () => script?.removeEventListener("load", onLoad);
}

export function NaverMap({
  coords,
  address,
  zoom = 16,
}: {
  coords?: Coords | null;
  address?: string;
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const keyId = process.env.NEXT_PUBLIC_NCP_MAP_KEY_ID;
  const source = useMemo(
    () => resolveMapSource(coords, address),
    [coords?.lat, coords?.lng, address],
  );
  const sourceId = source
    ? source.kind === "coords"
      ? `coords:${source.coords.lat},${source.coords.lng}`
      : `address:${source.address}`
    : null;
  const [failedSourceId, setFailedSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (!keyId || !ref.current || !source) return;

    function render(lat: number, lng: number) {
      const naver = window.naver;
      if (!naver?.maps || !ref.current) return;
      const pos = new naver.maps.LatLng(lat, lng);
      const map = new naver.maps.Map(ref.current, { center: pos, zoom });
      new naver.maps.Marker({ position: pos, map });
    }

    return loadSdk(keyId, () => {
      const naver = window.naver;
      if (source.kind === "coords") {
        render(source.coords.lat, source.coords.lng);
        return;
      }
      if (!naver?.maps?.Service) {
        setFailedSourceId(sourceId);
        return;
      }
      naver.maps.Service.geocode(
        { query: source.address },
        (status: string, res: any) => {
          const item = res?.v2?.addresses?.[0];
          const lat = Number(item?.y);
          const lng = Number(item?.x);
          if (
            status !== naver.maps.Service.Status.OK ||
            !item ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
          ) {
            setFailedSourceId(sourceId);
            return;
          }
          render(lat, lng);
        },
      );
    });
  }, [keyId, source, zoom]);

  if (!keyId || !source || failedSourceId === sourceId) return null;
  return <div ref={ref} className="h-56 w-full overflow-hidden rounded-md" />;
}
