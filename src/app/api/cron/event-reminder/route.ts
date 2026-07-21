import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCommunity } from "@/lib/community";
import { hasValidCronAuthorization } from "@/lib/cron";
import { buildEventReminderMessage } from "@/lib/event-reminder";
import { postSlack } from "@/lib/slack";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET이 설정되지 않았어요" },
      { status: 401 },
    );
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
  const community = await getCommunity({ client: supabase });
  const now = new Date();
  const dayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const events = await community.events.eventsStartingBetween(
    now.toISOString(),
    dayLater.toISOString(),
  );
  const counts = await community.events.confirmedCounts(events.map((event) => event.id));
  const message = buildEventReminderMessage(events, counts);

  if (!message) {
    return NextResponse.json({ sent: false, count: 0 });
  }

  const { error } = await postSlack(message);
  if (error) {
    return NextResponse.json({ error, sent: false, count: events.length });
  }

  return NextResponse.json({ sent: true, count: events.length });
}
