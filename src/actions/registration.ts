"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import type { ActionResult, RegistrationStatus } from "@/lib/types";

export async function registerForEvent(
  eventId: string,
): Promise<ActionResult & { status?: RegistrationStatus }> {
  await requireProfile();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_event", {
    p_event_id: eventId,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/profile");

  return { status: data as RegistrationStatus };
}

export async function cancelRegistration(eventId: string): Promise<ActionResult> {
  await requireProfile();

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_registration", {
    p_event_id: eventId,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/profile");

  return {};
}
