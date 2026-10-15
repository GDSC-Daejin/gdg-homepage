import { createHmac, timingSafeEqual } from "node:crypto";

// Resend webhook은 Svix 형식으로 서명한다: base64(HMAC-SHA256(secret, `${svix-id}.${svix-timestamp}.${body}`)).
// 재전송 공격을 막기 위해 svix-timestamp가 이 범위를 벗어나면 거절한다.
export const RESEND_WEBHOOK_TOLERANCE_SECONDS = 300;

export type ResendSignatureCheck = "ok" | "missing_headers" | "stale_timestamp" | "invalid_signature";

export function verifyResendSignature(
  payload: string,
  headers: Headers,
  secret: string,
  nowMs: number = Date.now(),
): ResendSignatureCheck {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) return "missing_headers";

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowMs / 1000 - timestampSeconds) > RESEND_WEBHOOK_TOLERANCE_SECONDS) {
    return "stale_timestamp";
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64"));
  // 키 교체 중에는 "v1,<sig> v1,<sig>"처럼 여러 서명이 온다. 하나라도 맞으면 통과.
  const matched = signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const actual = Buffer.from(value);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  return matched ? "ok" : "invalid_signature";
}

const EMAIL_STATUS_BY_EVENT: ReadonlyMap<string, string> = new Map([
  ["email.delivered", "delivered"],
  ["email.delivery_delayed", "delivery_delayed"],
  ["email.bounced", "bounced"],
  ["email.complained", "complained"],
  ["email.suppressed", "suppressed"],
  ["email.failed", "failed"],
]);

/** 메일 로그 상태를 바꾸는 이벤트만 상태를 돌려준다. sent·opened·clicked 등은 null. */
export function emailStatusForEvent(type: unknown): string | null {
  return typeof type === "string" ? EMAIL_STATUS_BY_EVENT.get(type) ?? null : null;
}
