type ReactionEvent = { type?: string; user?: string; item_user?: string; reaction?: string; item?: { ts?: string } };

export type EventStore = {
  from: (table: string) => {
    insert: (value: { event_id: string }) => PromiseLike<{ error: unknown }>;
  };
};

export function shouldProcess(event: ReactionEvent) {
  return event.type === "reaction_added"
    && event.reaction === "pokeball"
    && Boolean(event.user)
    && Boolean(event.item?.ts)
    && event.user !== event.item_user;
}

export async function claimSlackEvent(supabase: EventStore, eventId: string) {
  const { error } = await supabase.from("pokedex_slack_events").insert({ event_id: eventId });
  return !error;
}

export type MentionEvent = { type?: string; user?: string; bot_id?: string; subtype?: string; text?: string; channel?: string; ts?: string; thread_ts?: string };

// 봇이 쓴 글(bot_id)이나 수정·삭제 같은 부가 이벤트(subtype)에는 답하지 않는다.
export function shouldProcessMention(event: MentionEvent) {
  return event.type === "app_mention"
    && Boolean(event.user)
    && !event.bot_id
    && !event.subtype
    && Boolean(event.channel)
    && Boolean(event.ts);
}
