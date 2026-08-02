import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !hasValidCronAuthorization(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase 서비스 롤 연동이 설정되지 않았어요" }, { status: 500 });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: bot } = await supabase.from("bots").select("active").eq("slug", "pokedex").single();
  if (!bot?.active) return NextResponse.json({ granted: 0, reason: "disabled" });

  const { data: granted, error } = await supabase.rpc("pokedex_grant_daily_balls");
  if (error) return NextResponse.json({ error: "몬스터볼을 지급하지 못했어요" }, { status: 500 });
  return NextResponse.json({ granted: granted ?? 0 });
}
