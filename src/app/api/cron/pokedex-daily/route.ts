import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasValidCronAuthorization } from "@/lib/cron";
import { planDailyAppearances } from "@/lib/pokedex/schedule";

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
  if (!bot?.active) return NextResponse.json({ scheduled: false, reason: "disabled" });

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const { count } = await supabase
    .from("pokemon_appearances")
    .select("id", { count: "exact", head: true })
    .eq("appears_on", today);
  if (count) return NextResponse.json({ scheduled: false, reason: "already_scheduled" });

  const { data: catalog } = await supabase
    .from("pokemon_catalog")
    .select("id, dwell_minutes, spawn_weight, activity_period")
    .eq("active", true);
  if (!catalog || catalog.length < 5) return NextResponse.json({ error: "출현 포켓몬이 부족해요" }, { status: 500 });

  const appearances = planDailyAppearances(
    new Date(),
    catalog.map((pokemon) => ({ id: pokemon.id, dwellMinutes: pokemon.dwell_minutes, spawnWeight: pokemon.spawn_weight, activityPeriod: pokemon.activity_period })),
  );
  const { error } = await supabase.from("pokemon_appearances").insert(
    appearances.map((appearance, index) => ({
      appears_on: today,
      appearance_order: index + 1,
      pokemon_id: appearance.pokemonId,
      starts_at: appearance.startsAt.toISOString(),
      ends_at: appearance.endsAt.toISOString(),
    })),
  );
  if (error) return NextResponse.json({ scheduled: false, reason: "already_scheduled" });
  return NextResponse.json({ scheduled: true });
}
