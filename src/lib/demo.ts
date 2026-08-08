import { headers } from "next/headers";
import { DEMO_MEMBERS } from "@/lib/demoData";
import type { Profile } from "@/lib/types";

export const DEMO_MODE_HEADER = "x-gdg-demo-mode";
export const DEMO_PROFILE: Profile = DEMO_MEMBERS[0];

export async function isDemoMode(): Promise<boolean> {
  return (await headers()).get(DEMO_MODE_HEADER) === "1";
}
