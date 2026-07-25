"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress, geocodeWithReason } from "@/lib/geocode";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

function readPlaceForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
  };
}

export async function createPlace(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const { name, address } = readPlaceForm(formData);
  if (!name) return { error: "장소명을 입력해주세요" };

  const coords = await geocodeAddress(address);
  const supabase = await createClient();
  const { error } = await supabase.from("places").insert({
    name,
    address,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });

  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/places");
  return {};
}

export async function updatePlace(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const { name, address } = readPlaceForm(formData);
  if (!name) return { error: "장소명을 입력해주세요" };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("places")
    .select("address")
    .eq("id", id)
    .single();

  if (fetchError) return { error: toKoreanError(fetchError) };

  const updates = { name, address };
  if (!address) {
    const { error } = await supabase
      .from("places")
      .update({ ...updates, lat: null, lng: null })
      .eq("id", id);

    if (error) return { error: toKoreanError(error) };
  } else if (address === existing.address) {
    const { error } = await supabase.from("places").update(updates).eq("id", id);

    if (error) return { error: toKoreanError(error) };
  } else {
    const coords = await geocodeAddress(address);
    if (!coords) return { error: "주소를 찾을 수 없어요" };

    const { error } = await supabase
      .from("places")
      .update({ ...updates, lat: coords.lat, lng: coords.lng })
      .eq("id", id);

    if (error) return { error: toKoreanError(error) };
  }
  revalidatePath("/admin/places");
  return {};
}

export async function deletePlace(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("places").delete().eq("id", id);

  if (error) return { error: toKoreanError(error) };
  revalidatePath("/admin/places");
  return {};
}

export interface BackfillFailure {
  name: string;
  address: string;
  reason: string;
}

export async function backfillPlaceCoords(): Promise<{
  error?: string;
  done?: number;
  failed?: number;
  failures?: BackfillFailure[];
}> {
  await requireAdmin();
  if (await isDemoMode()) return { done: 0, failed: 0, failures: [] };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("places")
    .select("id, name, address")
    .is("lat", null)
    .neq("address", "");

  if (error) return { error: toKoreanError(error) };

  const places = (rows ?? []) as { id: string; name: string; address: string }[];
  let done = 0;
  const failures: BackfillFailure[] = [];
  for (const place of places) {
    const result = await geocodeWithReason(place.address);
    if (!result.coords) {
      failures.push({ name: place.name, address: place.address, reason: result.reason });
      continue;
    }
    const { error } = await supabase
      .from("places")
      .update({ lat: result.coords.lat, lng: result.coords.lng })
      .eq("id", place.id);
    if (error) {
      failures.push({
        name: place.name,
        address: place.address,
        reason: `DB 저장 실패: ${toKoreanError(error)}`,
      });
    } else done += 1;
  }

  if (failures.length) {
    console.warn("[backfillPlaceCoords] 실패 목록", failures);
  }
  revalidatePath("/admin/places");
  return { done, failed: failures.length, failures };
}
