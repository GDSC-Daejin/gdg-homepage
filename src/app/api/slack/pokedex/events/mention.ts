import { createClient } from "@supabase/supabase-js";
import { buildMentionReply } from "@/lib/pokedex/mention-reply";
import type { PokemonProbabilityRow } from "@/lib/pokedex/probability";
import { postMessage } from "@/lib/slack/api";
import { claimSlackEvent, shouldProcessMention, type MentionEvent } from "./helpers";

export async function handleMention(event: MentionEvent, eventId: string) {
  const botToken = process.env.POKEDEX_SLACK_BOT_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!botToken || !url || !key || !shouldProcessMention(event)) return;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await claimSlackEvent(supabase, eventId))) return;

  const { data } = await supabase.from("pokemon_catalog").select("pokedex_no, name_ko, rarity, spawn_weight, catch_rate").order("pokedex_no");
  const text = buildMentionReply(event.text ?? "", (data ?? []) as PokemonProbabilityRow[]);
  await postMessage({ channel: event.channel!, threadTs: event.thread_ts ?? event.ts, text, botToken });
}
