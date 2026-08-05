import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { nudgeParticipants } from "@/lib/meeting-poll-nudge";

/**
 * 마감 전날 알림. "마감 전날 알림 보내기"가 켜진 조율 중 마감이 24시간 안으로 들어온 것에서
 * 아직 응답 안 한 회원에게 인앱 알림을 한 번만 보낸다(due_notified_at으로 중복 방지).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET이 설정되지 않았어요" }, { status: 401 });
  }
  if (!hasValidCronAuthorization(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase 서비스 롤 연동이 설정되지 않았어요" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const dayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: polls, error } = await supabase
    .from("meeting_polls")
    .select("id, title, is_mojisoop, is_regular_session")
    .eq("notify_before_due", true)
    .is("confirmed_at", null)
    .is("due_notified_at", null)
    .gt("due_at", now.toISOString())
    .lte("due_at", dayLater.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  const slackErrors: string[] = [];
  for (const poll of (polls ?? []) as { id: string; title: string; is_mojisoop: boolean; is_regular_session: boolean }[]) {
    const { data: pending, error: pendingError } = await supabase
      .from("meeting_poll_participants")
      .select("user_id")
      .eq("poll_id", poll.id)
      .is("responded_at", null)
      .not("user_id", "is", null);

    if (pendingError) {
      return NextResponse.json({ error: pendingError.message, sent }, { status: 500 });
    }

    const rows = ((pending ?? []) as { user_id: string }[]).map((p) => ({
      recipient_id: p.user_id,
      type: "meeting_poll_nudge",
      title: "오늘까지 회의 시간 응답을 받아요",
      body: poll.title,
      link: `/schedule/${poll.id}`,
    }));
    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("notifications").insert(rows);
      if (insertError) {
        return NextResponse.json({ error: insertError.message, sent }, { status: 500 });
      }
      sent += rows.length;
    }
    // 버튼과 같은 Slack 알림을 보낸다. 실패해도 다음 폴은 계속 돈다.
    const slackError = await nudgeParticipants(supabase, poll, "오늘 마감이에요");
    if (slackError) slackErrors.push(`${poll.title}: ${slackError}`);

    // 보낼 사람이 없어도 표시해 둔다 — 매 시간 같은 폴을 다시 훑지 않게.
    await supabase
      .from("meeting_polls")
      .update({ due_notified_at: now.toISOString() })
      .eq("id", poll.id);
  }

  return NextResponse.json({ polls: polls?.length ?? 0, sent, slackErrors });
}
