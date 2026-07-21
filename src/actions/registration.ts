"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import { postSlack } from "@/lib/slack";
import type { ActionResult, RegistrationStatus } from "@/lib/types";

export async function registerForEvent(
  eventId: string,
): Promise<ActionResult & { status?: RegistrationStatus }> {
  await requireProfile();
  if (await isDemoMode()) return { status: "confirmed" };

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
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_registration", {
    p_event_id: eventId,
  });

  if (error) return { error: toKoreanError(error) };

  const promotedName = data as string | null;
  if (promotedName) {
    const { data: event } = await supabase
      .from("events")
      .select("title")
      .eq("id", eventId)
      .single();
    await postSlack(
      `[정원 승급] ${promotedName}님이 '${event?.title ?? "이벤트"}' 확정으로 승급했어요`,
    );
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/profile");

  return {};
}
