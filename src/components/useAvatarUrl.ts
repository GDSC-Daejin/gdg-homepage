"use client";

import { useEffect, useState } from "react";

/**
 * 발급받은 서명 URL을 경로별로 들고 있는다.
 * 말풍선처럼 마운트가 잦은 곳에서 매번 새로 발급받으면 그 사이 이니셜이 번쩍인다.
 */
const CACHE = new Map<string, { url: string; expiresAt: number }>();
/** 같은 경로를 동시에 여러 아바타가 요청할 때 발급을 한 번으로 묶는다. */
const INFLIGHT = new Map<string, Promise<string | undefined>>();

const TTL_SEC = 60 * 60;
/** 만료 직전 URL을 물려주면 이미지가 깨진다 — 5분 남기고 새로 받는다. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** 아직 쓸 수 있는 캐시. 없으면 undefined. */
export function readAvatarUrl(avatarPath: string | null | undefined, now = Date.now()): string | undefined {
  if (!avatarPath) return undefined;
  const hit = CACHE.get(avatarPath);
  if (!hit) return undefined;
  if (hit.expiresAt <= now) {
    CACHE.delete(avatarPath);
    return undefined;
  }
  return hit.url;
}

export function writeAvatarUrl(avatarPath: string, url: string, now = Date.now()): void {
  CACHE.set(avatarPath, { url, expiresAt: now + TTL_SEC * 1000 - REFRESH_MARGIN_MS });
}

/** 테스트·재시도용. 깨진 URL을 물고 있지 않게 지운다. */
export function forgetAvatarUrl(avatarPath: string): void {
  CACHE.delete(avatarPath);
  INFLIGHT.delete(avatarPath);
}

function signedUrl(avatarPath: string): Promise<string | undefined> {
  const pending = INFLIGHT.get(avatarPath);
  if (pending) return pending;

  const request = (async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().storage.from("avatars").createSignedUrl(avatarPath, TTL_SEC);
    if (data?.signedUrl) writeAvatarUrl(avatarPath, data.signedUrl);
    return data?.signedUrl;
  })().finally(() => INFLIGHT.delete(avatarPath));

  INFLIGHT.set(avatarPath, request);
  return request;
}

/**
 * avatars 버킷은 비공개라 서명 URL이 필요하다. 한 번 받은 URL은 캐시에서 바로 꺼내
 * 첫 렌더부터 사진이 있는 상태로 시작한다 — 깜빡임이 없다.
 * 실패하면 한 번만 다시 받아보고, 그래도 안 되면 undefined로 두어 호출부가 이니셜을 그리게 한다.
 */
export function useAvatarUrl(avatarPath?: string | null): {
  src: string | undefined;
  onError: () => void;
} {
  const [src, setSrc] = useState<string | undefined>(() => readAvatarUrl(avatarPath));
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    const hit = readAvatarUrl(avatarPath);
    if (hit) {
      setSrc(hit);
      return;
    }

    setSrc(undefined);
    if (!avatarPath) return;

    let active = true;
    void signedUrl(avatarPath).then((url) => {
      if (active) setSrc(url);
    });

    return () => {
      active = false;
    };
  }, [avatarPath, retries]);

  return {
    src,
    onError: () => {
      if (avatarPath) forgetAvatarUrl(avatarPath);
      if (retries === 0) setRetries(1);
      else setSrc(undefined);
    },
  };
}
