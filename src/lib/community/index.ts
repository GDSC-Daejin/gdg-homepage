import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { demoCommunity } from "./demo";
import { supabaseCommunity } from "./supabase";
import type { Community } from "./types";

export type { AttendanceReads, Community, EventReads, EventUserPair } from "./types";

export async function getCommunity(opts?: {
  client?: SupabaseClient;
}): Promise<Community> {
  if (opts?.client) return supabaseCommunity(opts.client);
  if (await isDemoMode()) return demoCommunity;
  return supabaseCommunity(await createClient());
}
