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
    ends_at: formData.get("ends_at") || null,
    place_id: formData.get("place_id") || null,
    speaker: formData.get("speaker"),
    capacity: formData.get("capacity") || null,
  });
}

// 선택한 장소의 이름/주소를 이벤트에 스냅샷으로 복사 (표시·리마인더가 그대로 읽음)
async function placeSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  placeId: string | null,
) {
  if (!placeId) return { location: "", address: "" };
  const { data } = await supabase
    .from("places")
    .select("name, address")
    .eq("id", placeId)
    .single();
  return { location: data?.name ?? "", address: data?.address ?? "" };
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const snapshot = await placeSnapshot(supabase, parsed.data.place_id);
  const { error } = await supabase
    .from("events")
    .insert({ ...parsed.data, ...snapshot, created_by: profile.id });

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
  const snapshot = await placeSnapshot(supabase, parsed.data.place_id);
  const { error } = await supabase
    .from("events")
    .update({ ...parsed.data, ...snapshot })
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
