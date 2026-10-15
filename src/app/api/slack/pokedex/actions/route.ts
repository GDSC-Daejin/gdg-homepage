import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ownershipMessage } from "@/lib/pokedex/messages";
import { verifySlackSignature } from "@/lib/slack/verify";

type ActionPayload = { response_url?: string; user?: { id?: string }; actions?: Array<{ action_id?: string; value?: string }> };
type Appearance = { pokemon_id: string; pokemon: { name_ko: string } | { name_ko: string }[] | null };
type Catch = { appearance: { combat_power: number | null } | { combat_power: number | null }[] | null };

function reply(text: string) {
  return { response_type: "ephemeral", text };
}

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

async function handleAction(payload: ActionPayload) {
  const action = payload.actions?.[0];
  const slackUserId = payload.user?.id;
  const appearanceId = action?.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (action?.action_id !== "pokedex_ownership_check" || !slackUserId || !appearanceId || !url || !key) return reply("도감을 확인하지 못했어요. 다시 눌러 주세요.");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("slack_user_id", slackUserId).maybeSingle();
  if (profileError) return reply("도감을 불러오지 못했어요. 다시 시도해 주세요.");
  if (!profile) return reply("회원 승인과 Slack 계정 연결이 필요해요.");

  const { data: appearance, error: appearanceError } = await supabase.from("pokemon_appearances").select("pokemon_id, pokemon:pokemon_catalog(name_ko)").eq("id", appearanceId).maybeSingle<Appearance>();
  if (appearanceError || !appearance) return reply("출현 정보를 찾지 못했어요.");
  const pokemon = first(appearance.pokemon);
  if (!pokemon) return reply("출현 정보를 찾지 못했어요.");

  const { data: catches, error: catchError } = await supabase
    .from("pokemon_throws")
    .select("appearance:pokemon_appearances(combat_power)")
    .eq("user_id", profile.id)
    .eq("pokemon_id", appearance.pokemon_id)
    .eq("outcome", "caught");
  if (catchError) return reply("도감을 불러오지 못했어요. 다시 시도해 주세요.");
  return reply(ownershipMessage(pokemon.name_ko, (catches as Catch[] ?? []).map((caught) => first(caught.appearance)?.combat_power ?? null)));
}

async function postResponse(responseUrl: string, result: ReturnType<typeof reply>) {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(result),
    signal: AbortSignal.timeout(5000),
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingSecret = process.env.POKEDEX_SLACK_SIGNING_SECRET;
  if (!signingSecret || !verifySlackSignature({ rawBody, timestamp: request.headers.get("x-slack-request-timestamp"), signature: request.headers.get("x-slack-signature"), signingSecret })) return Response.json({ error: "invalid_signature" }, { status: 401 });
  let payload: ActionPayload;
  try { payload = JSON.parse(new URLSearchParams(rawBody).get("payload") ?? ""); } catch { return Response.json({ error: "invalid_payload" }, { status: 400 }); }
  if (!payload.response_url) return Response.json({ error: "invalid_payload" }, { status: 400 });
  after(async () => {
    const result = await handleAction(payload).catch(() => reply("도감을 불러오지 못했어요. 다시 시도해 주세요."));
    await postResponse(payload.response_url!, result);
  });
  return new Response();
}
