import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeAttendanceWarnings } from "@/lib/attendance-stats";
import { postSlack } from "@/lib/slack";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET이 설정되지 않았어요" },
      { status: 401 },
    );
  }

  if (
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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
  const warnings = await computeAttendanceWarnings(supabase);

  if (warnings.length === 0) {
    return NextResponse.json({ sent: false, count: 0 });
  }

  const lines = warnings
    .map((w) => `- ${w.name} (${Math.round(w.rate * 100)}%)`)
    .join("\n");
  const { error } = await postSlack(
    `[출석 경고] 출석률 50% 미만 회원 ${warnings.length}명\n${lines}`,
  );

  if (error) {
    return NextResponse.json({ error, sent: false, count: warnings.length });
  }

  return NextResponse.json({ sent: true, count: warnings.length });
}
