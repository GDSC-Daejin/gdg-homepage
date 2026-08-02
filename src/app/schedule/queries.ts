import { isDemoMode } from "@/lib/demo";
import { DEMO_MEETING_POLLS, DEMO_MEETING_POLL_PARTICIPANTS } from "@/lib/demoData";
import { createClient } from "@/lib/supabase/server";
import type { MeetingPoll, MeetingPollParticipant } from "@/lib/types";
import type { PollCard } from "./PollList";

/** 카드에 필요한 만큼만 추린 참여자. 둘러보기 모드와 실제 조회가 같은 모양으로 들어온다. */
type CardParticipant = Pick<MeetingPollParticipant, "poll_id" | "name" | "responded_at"> & {
  avatarPath: string | null;
};

/** 목록 두 화면(내 일정 / 지난 일정)이 같은 조회를 쓴다. */
export async function loadPollCards(kind: "active" | "past"): Promise<PollCard[]> {
  const { polls, participants } = await loadRows();

  const now = Date.now();
  const isPast = (poll: MeetingPoll) =>
    Boolean(poll.confirmed_at) || Boolean(poll.due_at && now > Date.parse(poll.due_at));

  return polls
    .filter((poll) => (kind === "past" ? isPast(poll) : !isPast(poll)))
    .map((poll) => {
      const mine = participants.filter((p) => p.poll_id === poll.id);
      const responded = mine.filter((p) => p.responded_at);
      return {
        poll,
        total: mine.length,
        responded: responded.length,
        people: responded.slice(0, 6).map((p) => ({ name: p.name, avatarPath: p.avatarPath })),
      };
    });
}

async function loadRows(): Promise<{ polls: MeetingPoll[]; participants: CardParticipant[] }> {
  if (await isDemoMode()) {
    return {
      polls: DEMO_MEETING_POLLS,
      participants: DEMO_MEETING_POLL_PARTICIPANTS.map((p) => ({ ...p, avatarPath: null })),
    };
  }

  const supabase = await createClient();
  const [{ data: pollRows }, { data: participantRows }] = await Promise.all([
    supabase.from("meeting_polls").select("*").order("created_at", { ascending: false }),
    // 아바타는 회원 프로필 사진을 쓴다 — user_id로 profiles를 함께 끌어온다.
    supabase
      .from("meeting_poll_participants")
      .select("poll_id, name, responded_at, profiles(avatar_path)"),
  ]);

  // profiles는 user_id FK를 타고 오는 1:1이라 배열이 아니라 객체다(RegistrantsTable과 같은 형태).
  const rows = (participantRows ?? []) as unknown as (Pick<
    MeetingPollParticipant,
    "poll_id" | "name" | "responded_at"
  > & { profiles: { avatar_path: string | null } | null })[];

  return {
    polls: (pollRows ?? []) as MeetingPoll[],
    participants: rows.map(({ profiles, ...p }) => ({
      ...p,
      avatarPath: profiles?.avatar_path ?? null,
    })),
  };
}
