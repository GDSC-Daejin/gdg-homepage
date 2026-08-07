import { DAILY_MESSAGES } from "@/lib/squirtle/messages";

export function pickMessageIndex(): number {
  return Math.floor(Math.random() * DAILY_MESSAGES.length);
}
