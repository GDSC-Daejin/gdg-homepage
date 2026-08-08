import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { DEMO_MEETING_POLL_PARTICIPANTS, DEMO_MEETING_POLLS } from "@/lib/demoData";
import { dayKeyKst, displayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { listPlaces } from "@/lib/places";
import { isOrganizer, type MeetingPoll } from "@/lib/types";
import { NewPollForm, type EditableParticipant, type MemberOption } from "../../new/NewPollForm";

export const dynamic = "force-dynamic";

export default async function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireAdmin();
  const demo = await isDemoMode();

  let poll: MeetingPoll | undefined;
  let participants: EditableParticipant[] = [];
  let members: MemberOption[] = [];

  if (demo) {
    poll = DEMO_MEETING_POLLS.find((item) => item.id === id);
    participants = DEMO_MEETING_POLL_PARTICIPANTS.filter((item) => item.poll_id === id);
  } else {
    const supabase = await createClient();
    const [{ data: pollRow }, { data: participantRows }, { data: staffRows }] = await Promise.all([
      supabase.from("meeting_polls").select("*").eq("id", id).single(),
      supabase.from("meeting_poll_participants").select("id, user_id, name, email").eq("poll_id", id),
      supabase
        .from("profiles")
        .select("id, name, nickname, avatar_path")
        .in("role", ["organizer", "team_member", "member"])
        .eq("status", "active")
        .not("approved_at", "is", null)
        .order("name"),
    ]);
    poll = pollRow as MeetingPoll | null ?? undefined;
    participants = (participantRows ?? []) as EditableParticipant[];
    members = ((staffRows ?? []) as { id: string; name: string; nickname: string; avatar_path: string | null }[]).map((item) => ({
      id: item.id,
      name: displayName(item.name, item.nickname),
      avatarPath: item.avatar_path,
    }));
  }

  if (!poll) notFound();
  if (poll.confirmed_at || (!demo && poll.created_by !== profile.id && !isOrganizer(profile))) {
    redirect(`/schedule/${id}`);
  }

  const places = await listPlaces();
  return (
    <NewPollForm
      today={dayKeyKst(new Date().toISOString())}
      members={members}
      inviteToken={poll.invite_token}
      places={places}
      edit={{ poll, participants }}
    />
  );
}
