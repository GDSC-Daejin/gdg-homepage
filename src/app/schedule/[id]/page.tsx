import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import {
  DEMO_MEETING_POLLS,
  DEMO_MEETING_POLL_PARTICIPANTS,
  DEMO_MEMBERS,
} from "@/lib/demoData";
import { displayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { isOrganizer, isStaff, type MeetingPoll, type MeetingPollParticipant } from "@/lib/types";
import { PollDetail } from "./PollDetail";

export const dynamic = "force-dynamic";

export default async function SchedulePollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();

  if (await isDemoMode()) {
    const demoPoll = DEMO_MEETING_POLLS.find((p) => p.id === id);
    if (!demoPoll) notFound();
    const demoParticipants = DEMO_MEETING_POLL_PARTICIPANTS.filter((p) => p.poll_id === id);
    const owner = DEMO_MEMBERS.find((m) => m.id === demoPoll.created_by);
    return (
      <PollDetail
        poll={demoPoll}
        participants={demoParticipants}
        // 둘러보기에서는 첫 참여자가 "나"다 — 격자를 칠해볼 수 있어야 화면을 다 보여준다.
        myParticipantId={demoParticipants[0]?.id ?? null}
        canManage
        canNudge
        ownerName={owner ? displayName(owner.name, owner.nickname) : "알 수 없음"}
      />
    );
  }

  const supabase = await createClient();
  const [{ data: pollRow }, { data: participantRows }] = await Promise.all([
    supabase
      .from("meeting_polls")
      .select("*, owner:profiles(name, nickname)")
      .eq("id", id)
      .single(),
    supabase
      // 아바타는 회원 프로필 사진을 쓴다 — user_id로 profiles를 함께 끌어온다.
      .from("meeting_poll_participants")
      .select("*, profiles(avatar_path)")
      .eq("poll_id", id)
      .order("created_at"),
  ]);

  if (!pollRow) notFound();
  const { owner: ownerProfile, ...poll } = pollRow as MeetingPoll & {
    owner: { name: string; nickname: string } | null;
  };
  const participants = ((participantRows ?? []) as (MeetingPollParticipant & {
    profiles: { avatar_path: string | null } | null;
  })[]).map(({ profiles, ...p }) => ({ ...p, avatar_path: profiles?.avatar_path ?? null }));

  const me = participants.find((p) => p.user_id === profile.id) ?? null;
  const canManage = isStaff(profile) && (poll.created_by === profile.id || isOrganizer(profile));
  const canNudge = canManage || (isStaff(profile) && poll.is_mojisoop);
  return (
    <PollDetail
      poll={poll}
      participants={participants}
      myParticipantId={me?.id ?? null}
      canManage={canManage}
      canNudge={canNudge}
      ownerName={
        ownerProfile ? displayName(ownerProfile.name, ownerProfile.nickname) : "알 수 없음"
      }
    />
  );
}
