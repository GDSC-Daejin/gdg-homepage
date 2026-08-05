"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eventSchema } from "@/lib/schemas";
import { shiftToDateKst } from "@/lib/calendar";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

function parseEventForm(formData: FormData) {
  const eventDate = String(formData.get("event_date") ?? "") || null;
  const startTime = String(formData.get("start_time") ?? "") || null;
  const endTime = String(formData.get("end_time") ?? "") || null;
  const iso = (time: string | null) => eventDate && time ? new Date(`${eventDate}T${time}+09:00`).toISOString() : null;
  return eventSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    starts_at: iso(startTime),
    ends_at: iso(endTime),
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

/**
 * 달력에서 일정을 다른 날짜로 끌어다 놓았을 때. KST 시각은 그대로 두고 날짜만 옮긴다.
 * 종료 시각은 시작으로부터의 간격을 유지해 자정을 넘기는 일정도 안 깨진다.
 */
export async function moveEvent(id: string, dateKey: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { error: "날짜 형식이 올바르지 않아요" };
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("starts_at, ends_at")
    .eq("id", id)
    .single();

  if (!event) return { error: "이벤트를 찾을 수 없어요" };

  const startsAt = shiftToDateKst(event.starts_at, dateKey);
  const endsAt = event.ends_at
    ? new Date(
        new Date(startsAt).getTime() +
          (new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()),
      ).toISOString()
    : null;

  const { error } = await supabase
    .from("events")
    .update({ starts_at: startsAt, ends_at: endsAt })
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
