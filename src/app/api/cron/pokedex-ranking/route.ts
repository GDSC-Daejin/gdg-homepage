import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { ownershipRankingMessage } from "@/lib/pokedex/messages";
import { pokemonOwnershipRanking } from "@/lib/pokedex/ranking";
import { postMessage } from "@/lib/slack/api";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !hasValidCronAuthorization(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.POKEDEX_SLACK_BOT_TOKEN;
  if (!url || !key) return NextResponse.json({ error: "Supabase 서비스 롤 연동이 설정되지 않았어요" }, { status: 500 });
  if (!botToken) return NextResponse.json({ error: "도감봇 토큰이 설정되지 않았어요" }, { status: 500 });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: bot } = await supabase.from("bots").select("active").eq("slug", "pokedex").single();
  if (!bot?.active) return NextResponse.json({ posted: false, reason: "disabled" });

  const [{ data: catches, error: catchesError }, { data: profiles, error: profilesError }, { data: config }] = await Promise.all([
    supabase.from("pokemon_throws").select("user_id, pokemon_id").eq("outcome", "caught"),
    supabase.from("profiles").select("id, slack_user_id").not("slack_user_id", "is", null),
    supabase.from("squirtle_config").select("channel_id").eq("id", 1).single(),
  ]);
  if (catchesError || profilesError || !config) return NextResponse.json({ error: "도감 랭킹을 조회하지 못했어요" }, { status: 500 });

  const rankings = pokemonOwnershipRanking(
    (catches ?? []).map((row) => ({ userId: row.user_id, pokemonId: row.pokemon_id })),
    new Map((profiles ?? []).flatMap((profile) => (profile.slack_user_id ? [[profile.id, profile.slack_user_id]] : []))),
  );
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const { error: reservationError } = await supabase
    .from("pokemon_ranking_posts")
    .insert({ posted_on: today, message_ts: `pending-${today}` });
  if (reservationError) return NextResponse.json({ posted: false, reason: "already_posted" });

  const posted = await postMessage({ channel: config.channel_id, text: ownershipRankingMessage(rankings), botToken });
  if (!posted.ok) {
    await supabase.from("pokemon_ranking_posts").delete().eq("posted_on", today);
    return NextResponse.json({ error: posted.error, posted: false }, { status: 502 });
  }
  await supabase.from("pokemon_ranking_posts").update({ message_ts: posted.ts }).eq("posted_on", today);
  return NextResponse.json({ posted: true, rankings: rankings.length });
}
