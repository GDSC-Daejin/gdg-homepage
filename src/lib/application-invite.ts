import { createHash, randomBytes } from "node:crypto";

export function createApplicationInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashApplicationInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function applicationInviteUrl(token: string): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${origin}/onboarding/invite?token=${encodeURIComponent(token)}`;
}
