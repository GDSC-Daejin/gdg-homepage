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
