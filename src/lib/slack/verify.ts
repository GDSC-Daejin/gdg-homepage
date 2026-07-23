import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 300;

export type VerifyParams = {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  signingSecret: string;
  now?: Date;
};

export function verifySlackSignature({
  rawBody,
  timestamp,
  signature,
  signingSecret,
  now = new Date(),
}: VerifyParams): boolean {
  if (!timestamp || !signature) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  if (Math.abs(Math.floor(now.getTime() / 1000) - sent) > MAX_SKEW_SECONDS) return false;

  const hmac = createHmac("sha256", signingSecret);
  hmac.update(`v0:${timestamp}:${rawBody}`);
  const expected = Buffer.from(`v0=${hmac.digest("hex")}`);
  const actual = Buffer.from(signature);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
