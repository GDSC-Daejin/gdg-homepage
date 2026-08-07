import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rejectionMessage, remainingBallsMessage, resultMessage, shouldAnnounceCatch, throwMessage, type ThrowOutcome } from "@/lib/pokedex/messages";
import { listWorkspaceMembers, postMessage } from "@/lib/slack/api";
import { verifySlackSignature } from "@/lib/slack/verify";
import { claimSlackEvent, shouldProcess, type EventStore } from "./helpers";

type ReactionEvent = { type?: string; user?: string; item_user?: string; reaction?: string; item?: { ts?: string } };
type PokedexResult = {
  processed: boolean;
  reason?: "unlinked" | "invalid" | "expired" | "already_thrown" | "no_ball";
  outcome?: ThrowOutcome;
  pokemon_name?: string;
  remaining_balls?: number;
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function handleReaction(event: ReactionEvent, eventId: string) {
  const botToken = process.env.POKEDEX_SLACK_BOT_TOKEN;
  const supabase = serviceClient();
  if (!botToken || !supabase || !shouldProcess(event) || !event.user || !event.item?.ts) return;
  if (!(await claimSlackEvent(supabase, eventId))) return;
  const slackUser = event.user;
  const messageTs = event.item.ts;

  const { data: appearance } = await supabase.from("pokemon_appearances").select("id, pokemon_catalog(rarity)").eq("message_ts", messageTs).maybeSingle();
  if (!appearance) return;
  const catalog = appearance.pokemon_catalog as { rarity?: string } | { rarity?: string }[] | null;
  const rarity = (Array.isArray(catalog) ? catalog[0] : catalog)?.rarity;
  const { data: config } = await supabase.from("squirtle_config").select("channel_id").eq("id", 1).single();
  if (!config) return;
  const slackName = (await listWorkspaceMembers()).find((member) => member.id === slackUser)?.name ?? slackUser;

  const { data, error } = await supabase.rpc("pokedex_throw_ball", { p_slack_user: slackUser, p_message_ts: messageTs });
  if (error) return;
  const result = data as PokedexResult;
  if (!result.processed) {
    if (!result.reason) return;
    const { error: noticeError } = await supabase.from("pokemon_throw_notices").insert({
      appearance_id: appearance.id,
      slack_user_id: slackUser,
      reason: result.reason,
    });
    if (noticeError) return;
    const text = result.reason ? rejectionMessage(slackUser, slackName, result.reason, result.pokemon_name) : null;
    if (text) await postMessage({ channel: config.channel_id, threadTs: messageTs, text, botToken });
    return;
  }

  const pokemonName = result.pokemon_name ?? "포켓몬";
  await postMessage({ channel: config.channel_id, threadTs: messageTs, text: throwMessage(slackUser, slackName), botToken });
  const outcomeText = resultMessage(slackUser, slackName, pokemonName, result.outcome!);
  await postMessage({ channel: config.channel_id, threadTs: messageTs, text: outcomeText, botToken });
  await postMessage({ channel: config.channel_id, threadTs: messageTs, text: remainingBallsMessage(slackUser, result.remaining_balls ?? 0), botToken });
  if (result.outcome === "caught" && shouldAnnounceCatch(rarity)) await postMessage({ channel: config.channel_id, text: outcomeText, botToken });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingSecret = process.env.POKEDEX_SLACK_SIGNING_SECRET;
  if (!signingSecret) return Response.json({ error: "not_configured" }, { status: 500 });
  const valid = verifySlackSignature({ rawBody, timestamp: request.headers.get("x-slack-request-timestamp"), signature: request.headers.get("x-slack-signature"), signingSecret });
  if (!valid) return Response.json({ error: "invalid_signature" }, { status: 401 });

  let payload: { type?: string; challenge?: string; event_id?: string; event?: ReactionEvent };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (payload.type === "url_verification") return Response.json({ challenge: payload.challenge });
  if (payload.event && payload.event_id) after(() => handleReaction(payload.event!, payload.event_id!).catch(() => undefined));
  return Response.json({ ok: true });
}
