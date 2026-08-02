import "../../wds.css";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Participant } from "@/lib/meeting-poll";
import { GuestRespond, type GuestPoll } from "./GuestRespond";

export const dynamic = "force-dynamic";

export const metadata = { title: "언제되지", robots: { index: false, follow: false } };

/** 초대 링크. 로그인 없이 열리므로 RLS를 우회하는 토큰 RPC만 쓴다. */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_meeting_poll_by_token", {
    p_token: token,
  });

  if (error || !data) notFound();
  const payload = data as {
    poll: GuestPoll;
    participants: { id: string; name: string; slots: string[] | null; responded_at: string | null }[];
  };

  const participants: Participant[] = payload.participants.map((p) => ({
    id: p.id,
    user_id: null,
    name: p.name,
    email: null,
    slots: p.slots ?? [],
    responded_at: p.responded_at,
  }));

  return <GuestRespond token={token} poll={payload.poll} participants={participants} />;
}
