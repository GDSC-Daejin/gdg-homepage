"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eventSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    starts_at: formData.get("starts_at"),
    location: formData.get("location"),
    speaker: formData.get("speaker"),
    capacity: formData.get("capacity") || null,
  });
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .insert({ ...parsed.data, created_by: profile.id });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/events");
  revalidatePath("/");
  return {};
}

export async function updateEvent(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  revalidatePath(`/events/${id}`);
  revalidatePath("/");
  return {};
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/events");
  revalidatePath("/");
  return {};
}
