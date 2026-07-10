"use server";

import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { DEMO_MODE_COOKIE } from "@/lib/demo";

export async function setDemoMode(on: boolean): Promise<void> {
  await requireAdmin();
  const store = await cookies();
  if (on) {
    store.set(DEMO_MODE_COOKIE, "1", { path: "/" });
  } else {
    store.delete(DEMO_MODE_COOKIE);
  }
}
