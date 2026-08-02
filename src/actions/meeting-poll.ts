"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { DEMO_MEETING_POLLS } from "@/lib/demoData";
import { toKoreanError } from "@/lib/errors";
import { nudgeAdminChannel } from "@/lib/meeting-poll-nudge";
import {
  DURATION_OPTIONS,
  MAX_POLL_DAYS,
  normalizeSlots,
  pollSlotSet,
  remapAvailabilitySlots,
  SLOT_UNITS,
  type SlotUnit,
} from "@/lib/meeting-poll";
import { createWeeklyPage } from "@/lib/notion";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, MeetingPoll } from "@/lib/types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NewPollInput {
  title: string;
  dates: string[];
  startHour: number;
  endHour: number;
  slotMin: number;
  dueAt: string | null;
  notifyBeforeDue: boolean;
  /** 만들기 화면이 미리 보여준 초대 링크를 그대로 쓴다 */
  inviteToken: string;
  /** 우리 회원 참여자 (profiles.id) */
  memberIds: string[];
  /** 이름만/이메일만 있는 참여자 */
  guests: { name: string; email: string | null }[];
}

export interface UpdatePollInput {
  title: string;
  dates: string[];
  startHour: number;
  endHour: number;
  slotMin: number;
  dueAt: string | null;
  notifyBeforeDue: boolean;
  participants: { id: string | null; userId: string | null; name: string; email: string | null }[];
}

export async function createMeetingPoll(
  input: NewPollInput,
): Promise<ActionResult & { id?: string }> {
  const profile = await requireAdmin();
  // 폼은 성공하면 /schedule/<id>로 넘어간다 — 빈 응답을 주면 /schedule/undefined로 가 404가 난다.
  if (await isDemoMode()) return { id: DEMO_MEETING_POLLS[0].id };

  const title = input.title.trim();
  const dates = [...new Set(input.dates)].filter((d) => DAY.test(d)).sort();

  if (!title) return { error: "일정 이름을 입력해주세요" };
  if (dates.length === 0) return { error: "날짜를 하나 이상 고르세요" };
  if (dates.length > MAX_POLL_DAYS) {
    return { error: `날짜는 ${MAX_POLL_DAYS}일까지만 고를 수 있어요` };
  }
  if (!Number.isInteger(input.startHour) || input.startHour < 0 || input.startHour > 23) {
    return { error: "시작 시간을 선택해주세요" };
  }
  if (!Number.isInteger(input.endHour) || input.endHour < 1 || input.endHour > 24) {
    return { error: "종료 시간을 선택해주세요" };
  }
  if (input.endHour <= input.startHour) {
    return { error: "종료 시간이 시작 시간보다 늦어야 해요" };
  }
  if (!SLOT_UNITS.includes(input.slotMin as SlotUnit)) {
    return { error: "칸 단위를 선택해주세요" };
  }
  if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) {
    return { error: "응답 마감을 다시 선택해주세요" };
  }

  const guests = input.guests
    .map((g) => ({ name: g.name.trim(), email: g.email?.trim() || null }))
    .filter((g) => g.name.length > 0);
  const memberIds = [...new Set(input.memberIds)];
  if (memberIds.length + guests.length === 0) {
    return { error: "참여자를 한 명 이상 초대하세요" };
  }

  const supabase = await createClient();
  const { data: poll, error } = await supabase
    .from("meeting_polls")
    .insert({
      title,
      dates,
      start_hour: input.startHour,
      end_hour: input.endHour,
      slot_min: input.slotMin,
      due_at: input.dueAt,
      notify_before_due: input.notifyBeforeDue,
      invite_token: UUID.test(input.inviteToken) ? input.inviteToken : undefined,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { error: toKoreanError(error) };
  const pollId = poll.id as string;

  // 회원 참여자는 표시 이름을 profiles에서 굳혀 넣는다 — 나중에 닉네임이 바뀌어도
  // 이 폴의 아바타 색·이니셜이 흔들리지 않는다.
  let rows: { poll_id: string; user_id: string | null; name: string; email: string | null }[] = [];
  if (memberIds.length > 0) {
    const { data: members, error: memberError } = await supabase
      .from("profiles")
      .select("id, name, nickname, email")
      .in("id", memberIds);
    if (memberError) return { error: toKoreanError(memberError) };
    rows = (members ?? []).map((m) => {
      const person = m as { id: string; name: string; nickname: string; email: string | null };
      return {
        poll_id: pollId,
        user_id: person.id,
        name: person.nickname?.trim()
          ? `${person.nickname}(${person.name})`
          : person.name,
        email: person.email ?? null,
      };
    });
  }
  rows.push(
    ...guests.map((g) => ({
      poll_id: pollId,
      user_id: null,
      name: g.name,
      email: g.email,
    })),
  );

  const { error: participantError } = await supabase
    .from("meeting_poll_participants")
    .insert(rows);
  if (participantError) return { error: toKoreanError(participantError) };

  revalidatePath("/schedule");
  return { id: pollId };
}

/** 확정 전 조율의 후보·명단을 바꾸고, 새 후보를 완전히 덮는 기존 응답만 보존한다. */
export async function updateMeetingPoll(
  pollId: string,
  input: UpdatePollInput,
): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const title = input.title.trim();
  const dates = [...new Set(input.dates)].filter((d) => DAY.test(d)).sort();
  if (!title) return { error: "일정 이름을 입력해주세요" };
  if (dates.length === 0) return { error: "날짜를 하나 이상 고르세요" };
  if (dates.length > MAX_POLL_DAYS) return { error: `날짜는 ${MAX_POLL_DAYS}일까지만 고를 수 있어요` };
  if (!Number.isInteger(input.startHour) || input.startHour < 0 || input.startHour > 23) {
    return { error: "시작 시간을 선택해주세요" };
  }
  if (!Number.isInteger(input.endHour) || input.endHour < 1 || input.endHour > 24) {
    return { error: "종료 시간을 선택해주세요" };
  }
  if (input.endHour <= input.startHour) return { error: "종료 시간이 시작 시간보다 늦어야 해요" };
  if (!SLOT_UNITS.includes(input.slotMin as SlotUnit)) return { error: "칸 단위를 선택해주세요" };
  if (input.dueAt && Number.isNaN(Date.parse(input.dueAt))) {
    return { error: "응답 마감을 다시 선택해주세요" };
  }

  const supabase = await createClient();
  const [{ data: pollRow, error: pollError }, { data: participantRows, error: participantError }] =
    await Promise.all([
      supabase.from("meeting_polls").select("*").eq("id", pollId).single(),
      supabase.from("meeting_poll_participants").select("*").eq("poll_id", pollId),
    ]);
  if (pollError || !pollRow) return { error: toKoreanError(pollError) };
  if (participantError) return { error: toKoreanError(participantError) };
  const poll = pollRow as MeetingPoll;
  if (poll.confirmed_at) return { error: "확정된 일정은 수정할 수 없어요" };
  if (poll.created_by !== profile.id && profile.role !== "organizer") {
    return { error: "일정을 수정할 권한이 없어요" };
  }

  const participants = (participantRows ?? []) as {
    id: string;
    user_id: string | null;
    slots: string[];
    responded_at: string | null;
  }[];
  const memberIds = [...new Set(input.participants.flatMap((p) => (p.userId ? [p.userId] : [])))];
  const existingMemberIds = new Set(participants.flatMap((p) => (p.user_id ? [p.user_id] : [])));
  const existingGuestIds = new Set(participants.filter((p) => !p.user_id).map((p) => p.id));
  const keptGuestIds = new Set(
    input.participants.flatMap((p) => (!p.userId && p.id && existingGuestIds.has(p.id) ? [p.id] : [])),
  );
  const keepIds = new Set(
    participants.flatMap((p) => (p.user_id ? (memberIds.includes(p.user_id) ? [p.id] : []) : keptGuestIds.has(p.id) ? [p.id] : [])),
  );
  const newMemberIds = memberIds.filter((id) => !existingMemberIds.has(id));
  const newGuests = input.participants
    .filter((p) => !p.userId && !p.id)
    .map((p) => ({ name: p.name.trim(), email: p.email?.trim() || null }))
    .filter((p) => p.name);
  if (memberIds.length + keptGuestIds.size + newGuests.length === 0) {
    return { error: "참여자를 한 명 이상 초대하세요" };
  }
  let newRows: { poll_id: string; user_id: string | null; name: string; email: string | null }[] = [];
  if (newMemberIds.length) {
    const { data: members, error } = await supabase
      .from("profiles")
      .select("id, name, nickname, email")
      .in("id", newMemberIds);
    if (error) return { error: toKoreanError(error) };
    if ((members ?? []).length !== newMemberIds.length) {
      return { error: "참여자를 다시 선택해주세요" };
    }
    newRows = (members ?? []).map((m) => {
      const person = m as { id: string; name: string; nickname: string; email: string | null };
      return {
        poll_id: pollId,
        user_id: person.id,
        name: person.nickname?.trim() ? `${person.nickname}(${person.name})` : person.name,
        email: person.email ?? null,
      };
    });
  }
  newRows.push(...newGuests.map((p) => ({ poll_id: pollId, user_id: null, ...p })));

  const nextPoll = {
    dates,
    start_hour: input.startHour,
    end_hour: input.endHour,
    slot_min: input.slotMin,
  };
  const { error: updateError } = await supabase
    .from("meeting_polls")
    .update({
      title,
      dates,
      start_hour: input.startHour,
      end_hour: input.endHour,
      slot_min: input.slotMin,
      due_at: input.dueAt,
      notify_before_due: input.notifyBeforeDue,
      due_notified_at: poll.due_at === input.dueAt ? poll.due_notified_at : null,
    })
    .eq("id", pollId);
  if (updateError) return { error: toKoreanError(updateError) };

  const removedIds = participants.filter((p) => !keepIds.has(p.id)).map((p) => p.id);
  if (removedIds.length) {
    const { error } = await supabase.from("meeting_poll_participants").delete().in("id", removedIds);
    if (error) return { error: toKoreanError(error) };
  }
  if (newRows.length) {
    const { error } = await supabase.from("meeting_poll_participants").insert(newRows);
    if (error) return { error: toKoreanError(error) };
  }
  const remapResults = await Promise.all(
    participants
      .filter((p) => keepIds.has(p.id))
      .map((p) => {
        const slots = remapAvailabilitySlots(p.slots, poll.slot_min, nextPoll);
        return supabase
          .from("meeting_poll_participants")
          .update({ slots, responded_at: slots.length && p.responded_at ? p.responded_at : null })
          .eq("id", p.id);
      }),
  );
  const remapError = remapResults.find((result) => result.error)?.error;
  if (remapError) return { error: toKoreanError(remapError) };

  revalidatePath(`/schedule/${pollId}`);
  revalidatePath("/schedule");
  return {};
}

/** 내 응답 전체를 통째로 덮어쓴다. 칸마다 저장하면 드래그 한 번에 요청이 수십 번 간다. */
export async function saveMyAvailability(
  pollId: string,
  slots: string[],
): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { data: poll, error: pollError } = await supabase
    .from("meeting_polls")
    .select("*")
    .eq("id", pollId)
    .single();

  if (pollError) return { error: toKoreanError(pollError) };
  const target = poll as MeetingPoll;
  if (target.confirmed_at) return { error: "확정된 일정은 응답을 바꿀 수 없어요" };
  if (target.due_at && Date.now() > Date.parse(target.due_at)) {
    return { error: "응답 마감이 지났어요" };
  }

  // 격자 밖 슬롯은 버린다. 클라이언트가 보낸 배열이라 그대로 믿으면 히트맵이 오염된다.
  const valid = pollSlotSet(target);
  const unique = [...new Set(normalizeSlots(slots))].filter((slot) => valid.has(slot));

  const { data, error } = await supabase
    .from("meeting_poll_participants")
    .update({ slots: unique, responded_at: new Date().toISOString() })
    .eq("poll_id", pollId)
    .eq("user_id", profile.id)
    .select("id");

  if (error) return { error: toKoreanError(error) };
  if (!data?.length) return { error: "이 일정의 참여자가 아니에요" };

  revalidatePath(`/schedule/${pollId}`);
  return {};
}

export async function confirmMeetingPoll(
  pollId: string,
  startIso: string,
  durationMin: number,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  if (Number.isNaN(Date.parse(startIso))) return { error: "시간을 다시 선택해주세요" };
  if (!DURATION_OPTIONS.includes(durationMin as (typeof DURATION_OPTIONS)[number])) {
    return { error: "소요 시간을 선택해주세요" };
  }

  const supabase = await createClient();
  // RLS가 생성자·organizer만 통과시킨다. 여기서 권한을 다시 세지 않는다.
  const { data, error } = await supabase
    .from("meeting_polls")
    .update({
      confirmed_at: new Date(startIso).toISOString(),
      duration_min: durationMin,
    })
    .eq("id", pollId)
    .is("confirmed_at", null)
    .select("id");

  if (error) return { error: toKoreanError(error) };
  if (!data?.length) return { error: "확정 권한이 없거나 이미 확정된 일정이에요" };

  revalidatePath(`/schedule/${pollId}`);
  revalidatePath("/schedule");
  revalidatePath("/admin/events");

  // 확정은 이미 끝났다. 노션이 실패해도 되돌리지 않고 경고만 올린다.
  const weekly = await createWeeklyPage(startIso);
  return weekly.error
    ? { warning: `${weekly.error} — 노션에 "${weekly.title}"을 직접 만들어주세요` }
    : { warning: `노션에 "${weekly.title}" 페이지를 만들었어요` };
}

/** 확정 취소. 시간을 다시 잡을 때 일정을 새로 만들지 않아도 되게 둔다. */
export async function unconfirmMeetingPoll(pollId: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_polls")
    .update({ confirmed_at: null, duration_min: null })
    .eq("id", pollId)
    .select("id");

  if (error) return { error: toKoreanError(error) };
  if (!data?.length) return { error: "확정을 취소할 권한이 없어요" };

  revalidatePath(`/schedule/${pollId}`);
  revalidatePath("/schedule");
  revalidatePath("/admin/events");
  return {};
}

export async function deleteMeetingPoll(pollId: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_polls")
    .delete()
    .eq("id", pollId)
    .select("id");

  if (error) return { error: toKoreanError(error) };
  if (!data?.length) return { error: "삭제 권한이 없어요" };

  revalidatePath("/schedule");
  revalidatePath("/admin/events");
  return {};
}

/**
 * 아직 응답 안 한 사람 재촉하기. 두 갈래로 나간다.
 * - 인앱 알림: 회원으로 초대된 사람만(이름만 초대된 사람은 받을 곳이 없다)
 * - 운영진 슬랙 채널 멘션: 슬랙이 연결된 사람은 <@id>, 아니면 이름 그대로 — 아무도 빠뜨리지 않는다
 */
export async function nudgeMeetingPoll(
  pollId: string,
): Promise<ActionResult & { sent?: number }> {
  await requireAdmin();
  if (await isDemoMode()) return { sent: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nudge_meeting_poll", { p_poll: pollId });
  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/schedule/${pollId}`);
  const sent = Number(data ?? 0);

  const { data: pollRow } = await supabase
    .from("meeting_polls")
    .select("title")
    .eq("id", pollId)
    .single();
  const slackError = await nudgeAdminChannel(supabase, {
    id: pollId,
    title: (pollRow as { title: string } | null)?.title ?? "일정",
  });
  return slackError ? { sent, error: slackError } : { sent };
}

/** 초대 링크로 들어온 사람의 응답 저장. 로그인 없이 토큰으로만 통과한다. */
export async function respondByToken(
  token: string,
  participantId: string,
  slots: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_meeting_poll_by_token", {
    p_token: token,
    p_participant: participantId,
    p_slots: [...new Set(normalizeSlots(slots))],
  });
  if (error) return { error: toKoreanError(error) };
  revalidatePath(`/j/${token}`);
  return {};
}
