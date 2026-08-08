"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { sendInterviewConfirmEmail, sendInterviewInviteEmail } from "@/lib/email";
import { toKoreanError } from "@/lib/errors";
import { syncInterviewCalendarEvent } from "@/lib/google-calendar";
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

async function syncCalendarForSlot(slotId: string) {
  const svc = serviceClient();
  const { data: slot, error: slotError } = await svc
    .from("interview_slots")
    .select("season, starts_at, duration_min, application_id, interviewer_id, meet_uri, calendar_event_id")
    .eq("id", slotId)
    .single();
  if (slotError || !slot) throw new Error("INTERVIEW_SLOT_NOT_FOUND");
  if (!slot.application_id || !slot.meet_uri) return false;

  const { data: application } = await svc
    .from("applications")
    .select("applicant_name, email")
    .eq("id", slot.application_id)
    .single();
  if (!application?.email) throw new Error("APPLICATION_EMAIL_MISSING");

  const attendeeEmails = [application.email];
  if (slot.interviewer_id) {
    const { data: interviewer } = await svc
      .from("profiles")
      .select("email")
      .eq("id", slot.interviewer_id)
      .single();
    if (interviewer?.email) attendeeEmails.push(interviewer.email);
  }

  const { eventId } = await syncInterviewCalendarEvent({
    slotId,
    calendarEventId: slot.calendar_event_id,
    season: slot.season,
    startsAt: slot.starts_at,
    durationMin: slot.duration_min,
    applicantName: application.applicant_name,
    meetUri: slot.meet_uri,
    attendeeEmails,
  });
  const { error: saveError } = await svc
    .from("interview_slots")
    .update({ calendar_event_id: eventId })
    .eq("id", slotId);
  if (saveError) throw new Error("GOOGLE_CALENDAR_EVENT_SAVE_FAILED");
  return true;
}

async function sendConfirmationForSlot(slotId: string) {
  const svc = serviceClient();
  const { data: slot } = await svc
    .from("interview_slots")
    .select("starts_at, application_id, meet_uri")
    .eq("id", slotId)
    .single();
  if (!slot?.application_id || !slot.meet_uri) return { sent: false, skipped: true };

  const { data: application } = await svc
    .from("applications")
    .select("email, applicant_name")
    .eq("id", slot.application_id)
    .single();
  if (!application?.email) return { sent: false, skipped: true };

  return sendInterviewConfirmEmail({
    to: application.email,
    name: application.applicant_name,
    startsAt: slot.starts_at,
    meetUri: slot.meet_uri,
  });
}

const BOOK_ERRORS: Record<string, string> = {
  INVALID_TOKEN: "유효하지 않은 링크예요",
  ALREADY_BOOKED: "이미 예약한 면접이 있어요",
  SLOT_TAKEN: "방금 마감된 시간이에요. 다른 시간을 선택해주세요",
};

export async function createSlots(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return { error: "미리보기 모드에서는 면접 슬롯을 만들 수 없어요" };
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
  if (await isDemoMode()) return { error: "미리보기 모드에서는 면접관을 배정할 수 없어요" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_interviewer", {
    p_slot: slotId,
    p_interviewer: interviewerId,
  });
  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/interviews");
  try {
    await syncCalendarForSlot(slotId);
    return {};
  } catch {
    return { warning: "면접관은 배정됐지만 Google Calendar 동기화에 실패했어요" };
  }
}

export async function sendInvites(applicationIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return { error: "미리보기 모드에서는 면접 초대장을 보낼 수 없어요" };
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
  const results = await Promise.all(
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
  const skipped = results.filter((result) => result.skipped).length;
  const failed = results.filter((result) => !result.sent && !result.skipped).length;
  if (skipped) return { warning: "면접 예약 링크는 발급됐지만 Resend 설정이 없어 이메일을 보내지 못했어요" };
  if (failed) return { warning: `${failed}명에게 면접 예약 링크 발송에 실패했어요` };
  return {};
}

export async function bookSlot(
  token: string,
  slotId: string,
): Promise<ActionResult & { meetUri?: string }> {
  if (await isDemoMode()) return { error: "미리보기 모드에서는 면접을 예약할 수 없어요" };
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
    const { error: saveError } = await svc
      .from("interview_slots")
      .update({ meet_uri: space.meetingUri, meet_code: space.meetingCode })
      .eq("id", data);
    if (saveError) throw new Error("MEET_LINK_SAVE_FAILED");

    const warnings: string[] = [];
    try {
      await syncCalendarForSlot(data);
    } catch {
      warnings.push("Google Calendar 일정 생성에 실패했어요");
    }
    const confirmation = await sendConfirmationForSlot(data);
    if (!confirmation.sent) warnings.push("확정 이메일 발송에 실패했어요");
    revalidatePath("/interview");
    return { meetUri: space.meetingUri, warning: warnings.join(" ") || undefined };
  } catch {
    // Meet 오류는 예약을 취소하지 않으며 어드민이 재생성할 수 있어요.
    revalidatePath("/interview");
    return { warning: "면접 예약은 확정됐지만 Meet 링크를 자동 생성하지 못했어요" };
  }
}

export async function regenerateMeetLink(slotId: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return { error: "미리보기 모드에서는 Meet 링크를 만들 수 없어요" };
  try {
    const svc = serviceClient();
    const space = await createMeetSpace();
    const { error } = await svc
      .from("interview_slots")
      .update({ meet_uri: space.meetingUri, meet_code: space.meetingCode })
      .eq("id", slotId);
    if (error) return { error: "Meet 링크 저장에 실패했어요" };

    const warnings: string[] = [];
    try {
      await syncCalendarForSlot(slotId);
    } catch {
      warnings.push("Google Calendar 일정 동기화에 실패했어요");
    }
    const confirmation = await sendConfirmationForSlot(slotId);
    if (!confirmation.sent) warnings.push("확정 이메일 발송에 실패했어요");
    revalidatePath("/admin/interviews");
    return { warning: warnings.join(" ") || undefined };
  } catch {
    return { error: "Meet 링크 생성에 실패했어요. 잠시 후 다시 시도해주세요" };
  }
}

export async function syncInterviewCalendar(slotId: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return { error: "미리보기 모드에서는 캘린더를 동기화할 수 없어요" };
  try {
    await syncCalendarForSlot(slotId);
    revalidatePath("/admin/interviews");
    return {};
  } catch {
    return { error: "Google Calendar 일정 동기화에 실패했어요. 설정을 확인한 뒤 다시 시도해주세요" };
  }
}
