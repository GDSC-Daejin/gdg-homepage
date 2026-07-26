import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAttendanceWarnings } from "@/lib/attendance-warning";
import { hasValidCronAuthorization } from "@/lib/cron";
import { getCommunity } from "@/lib/community";

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
  const { error, count, skipped } = await sendAttendanceWarnings(community.attendance, supabase);

  if (error) {
    return NextResponse.json({ error, sent: false, count });
  }

  if (skipped) {
    return NextResponse.json({ sent: false, count: 0, reason: "already_sent_today" });
  }

  return NextResponse.json({ sent: count > 0, count });
}
