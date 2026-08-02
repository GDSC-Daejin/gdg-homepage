import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resultMessage, throwMessage, type ThrowOutcome } from "@/lib/pokedex/messages";
import { postMessage } from "@/lib/slack/api";
import { verifySlackSignature } from "@/lib/slack/verify";

type ReactionEvent = { type?: string; user?: string; item_user?: string; reaction?: string; item?: { ts?: string } };
type PokedexResult = {
  processed: boolean;
  reason?: "unlinked" | "invalid" | "expired" | "already_thrown" | "no_ball";
  outcome?: ThrowOutcome;
  pokemon_name?: string;
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function shouldProcess(event: ReactionEvent) {
  return event.type === "reaction_added"
    && event.reaction === "pokeball"
    && Boolean(event.user)
    && Boolean(event.item?.ts)
    && event.user !== event.item_user;
}

async function handleReaction(event: ReactionEvent) {
  const botToken = process.env.POKEDEX_SLACK_BOT_TOKEN;
  const supabase = serviceClient();
  if (!botToken || !supabase || !shouldProcess(event) || !event.user || !event.item?.ts) return;
  const slackUser = event.user;
  const messageTs = event.item.ts;

  const { data: appearance } = await supabase.from("pokemon_appearances").select("id").eq("message_ts", messageTs).maybeSingle();
  if (!appearance) return;
  const { data: config } = await supabase.from("squirtle_config").select("channel_id").eq("id", 1).single();
  if (!config) return;

  const { data, error } = await supabase.rpc("pokedex_throw_ball", { p_slack_user: slackUser, p_message_ts: messageTs });
  if (error) return;
  const result = data as PokedexResult;
  if (!result.processed) {
    const text = result.reason === "expired"
      ? `${result.pokemon_name ?? "포켓몬"}은 이미 사라졌어요.`
      : result.reason === "already_thrown"
        ? "오늘은 이미 몬스터볼을 던졌어요."
        : result.reason === "no_ball"
          ? "몬스터볼이 없어요."
          : result.reason === "unlinked"
            ? "연결된 서비스 계정을 찾지 못했어요."
            : null;
    if (text) await postMessage({ channel: config.channel_id, threadTs: messageTs, text, botToken });
    return;
  }

  const pokemonName = result.pokemon_name ?? "포켓몬";
  await postMessage({ channel: config.channel_id, threadTs: messageTs, text: throwMessage(slackUser), botToken });
  const outcomeText = resultMessage(slackUser, pokemonName, result.outcome!);
  await postMessage({ channel: config.channel_id, threadTs: messageTs, text: outcomeText, botToken });
  if (result.outcome === "caught") await postMessage({ channel: config.channel_id, text: outcomeText, botToken });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingSecret = process.env.POKEDEX_SLACK_SIGNING_SECRET;
  if (!signingSecret) return Response.json({ error: "not_configured" }, { status: 500 });
  const valid = verifySlackSignature({ rawBody, timestamp: request.headers.get("x-slack-request-timestamp"), signature: request.headers.get("x-slack-signature"), signingSecret });
  if (!valid) return Response.json({ error: "invalid_signature" }, { status: 401 });

  let payload: { type?: string; challenge?: string; event?: ReactionEvent };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (payload.type === "url_verification") return Response.json({ challenge: payload.challenge });
  if (payload.event) after(() => handleReaction(payload.event!).catch(() => undefined));
  return Response.json({ ok: true });
}
