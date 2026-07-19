"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geocode";
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

  const coords = await geocodeAddress(address);
  const supabase = await createClient();
  const { error } = await supabase
    .from("places")
    .update({ name, address, lat: coords?.lat ?? null, lng: coords?.lng ?? null })
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };
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

export async function backfillPlaceCoords(): Promise<{
  error?: string;
  done?: number;
  failed?: number;
}> {
  await requireAdmin();
  if (await isDemoMode()) return { done: 0, failed: 0 };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("places")
    .select("id, address")
    .is("lat", null)
    .neq("address", "");

  const places = (rows ?? []) as { id: string; address: string }[];
  let done = 0;
  let failed = 0;
  for (const place of places) {
    const coords = await geocodeAddress(place.address);
    if (!coords) {
      failed += 1;
      continue;
    }
    const { error } = await supabase
      .from("places")
      .update({ lat: coords.lat, lng: coords.lng })
      .eq("id", place.id);
    if (error) failed += 1;
    else done += 1;
  }

  revalidatePath("/admin/places");
  return { done, failed };
}
