import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { addReaction, postMessage } from "@/lib/slack/api";
import { appearanceMessage } from "@/lib/pokedex/messages";

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
  if (!bot?.active) return NextResponse.json({ posted: false, reason: "disabled" });

  const now = new Date().toISOString();
  await supabase.from("pokemon_appearances").update({ status: "scheduled", posting_started_at: null }).eq("status", "posting").lt("posting_started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  await supabase.from("pokemon_appearances").update({ status: "expired" }).eq("status", "scheduled").lt("ends_at", now);
  const { data: due } = await supabase
    .from("pokemon_appearances")
    .select("id, pokemon_id, starts_at, ends_at, combat_power")
    .eq("status", "scheduled")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("starts_at")
    .limit(1)
    .maybeSingle();
  if (!due) return NextResponse.json({ posted: false, reason: "none_due" });

  const { data: claimed } = await supabase
    .from("pokemon_appearances")
    .update({ status: "posting", posting_started_at: now })
    .eq("id", due.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ posted: false, reason: "claimed" });

  const [{ data: pokemon }, { data: config }] = await Promise.all([
    supabase.from("pokemon_catalog").select("name_ko, image_path").eq("id", due.pokemon_id).single(),
    supabase.from("squirtle_config").select("channel_id").eq("id", 1).single(),
  ]);
  if (!pokemon || !config) return NextResponse.json({ error: "도감봇 설정이 없어요" }, { status: 500 });

  const botToken = process.env.POKEDEX_SLACK_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "도감봇 토큰이 설정되지 않았어요" }, { status: 500 });

  const text = appearanceMessage(pokemon.name_ko, "pokeball", due.starts_at, due.ends_at, due.combat_power);
  const posted = await postMessage({
    channel: config.channel_id,
    text,
    botToken,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      { type: "image", image_url: pokemon.image_path, alt_text: `야생의 ${pokemon.name_ko}` },
    ],
  });
  if (!posted.ok) {
    await supabase.from("pokemon_appearances").update({ status: "scheduled", posting_started_at: null }).eq("id", due.id);
    return NextResponse.json({ error: posted.error, posted: false }, { status: 502 });
  }
  await supabase.from("pokemon_appearances").update({ status: "posted", message_ts: posted.ts, posting_started_at: null }).eq("id", due.id);
  await addReaction({ channel: config.channel_id, ts: posted.ts, emoji: "pokeball", botToken });
  return NextResponse.json({ posted: true });
}
