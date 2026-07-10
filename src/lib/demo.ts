import { cookies } from "next/headers";

export const DEMO_MODE_COOKIE = "demo_mode";

export async function isDemoMode(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_MODE_COOKIE)?.value === "1";
}
