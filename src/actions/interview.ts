"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { sendInterviewConfirmEmail, sendInterviewInviteEmail } from "@/lib/email";
import { toKoreanError } from "@/lib/errors";
import { createMeetSpace } from "@/lib/google-meet";
import { getRecruitingSettings } from "@/lib/recruiting";
import { interviewSlotsSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_ENV_MISSING");

  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const BOOK_ERRORS: Record<string, string> = {
  INVALID_TOKEN: "유효하지 않은 링크예요",
  ALREADY_BOOKED: "이미 예약한 면접이 있어요",
  SLOT_TAKEN: "방금 마감된 시간이에요. 다른 시간을 선택해주세요",
};

export async function createSlots(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = interviewSlotsSchema.safeParse({
    starts_at: formData.getAll("starts_at").map(String),
    duration_min: Number(formData.get("duration_min") ?? 30),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const settings = await getRecruitingSettings();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_interview_slots", {
    p_season: settings.season,
    p_starts_at: parsed.data.starts_at,
    p_duration_min: parsed.data.duration_min,
  });
  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interviews");
  return {};
}

export async function assignInterviewer(
  slotId: string,
  interviewerId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_interviewer", {
    p_slot: slotId,
    p_interviewer: interviewerId,
  });
  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interviews");
  return {};
}

export async function sendInvites(applicationIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (applicationIds.length === 0) return { error: "지원자를 선택해주세요" };

  const [settings, supabase] = await Promise.all([
    getRecruitingSettings(),
    createClient(),
  ]);
  const { data, error } = await supabase.rpc("admin_send_interview_invites", {
    p_application_ids: applicationIds,
  });
  if (error) return { error: toKoreanError(error) };

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const rows = (data ?? []) as {
    token: string;
    email: string;
    applicant_name: string;
  }[];
  await Promise.all(
    rows
      .filter((row) => row.email)
      .map((row) =>
        sendInterviewInviteEmail({
          to: row.email,
          name: row.applicant_name,
          season: settings.season,
          bookingUrl: `${origin}/interview?token=${row.token}`,
        }),
      ),
  );

  revalidatePath("/admin/interviews");
  return {};
}

export async function bookSlot(
  token: string,
  slotId: string,
): Promise<ActionResult & { meetUri?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_interview_slot", {
    p_token: token,
    p_slot: slotId,
  });
  if (error) {
    const code = String(error.message ?? "");
    const key = Object.keys(BOOK_ERRORS).find((name) => code.includes(name));
    return { error: key ? BOOK_ERRORS[key] : toKoreanError(error) };
  }

  try {
    const svc = serviceClient();
    const space = await createMeetSpace();
    await svc
      .from("interview_slots")
      .update({ meet_uri: space.meetingUri, meet_code: space.meetingCode })
      .eq("id", data);

    const { data: slot } = await svc
      .from("interview_slots")
      .select("starts_at, application_id")
      .eq("id", data)
      .single();
    if (slot?.application_id) {
      const { data: application } = await svc
        .from("applications")
        .select("email, applicant_name")
        .eq("id", slot.application_id)
        .single();
      if (application?.email) {
        await sendInterviewConfirmEmail({
          to: application.email,
          name: application.applicant_name,
          startsAt: slot.starts_at,
          meetUri: space.meetingUri,
        });
      }
    }
    revalidatePath("/interview");
    return { meetUri: space.meetingUri };
  } catch {
    // Meet 오류는 예약을 취소하지 않으며 어드민이 재생성할 수 있어요.
    revalidatePath("/interview");
    return {};
  }
}

export async function regenerateMeetLink(slotId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const svc = serviceClient();
    const space = await createMeetSpace();
    const { error } = await svc
      .from("interview_slots")
      .update({ meet_uri: space.meetingUri, meet_code: space.meetingCode })
      .eq("id", slotId);
    if (error) return { error: "Meet 링크 저장에 실패했어요" };

    revalidatePath("/admin/interviews");
    return {};
  } catch {
    return { error: "Meet 링크 생성에 실패했어요. 잠시 후 다시 시도해주세요" };
  }
}
