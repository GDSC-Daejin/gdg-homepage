export type ReactionEvent = { type?: string; user?: string; reaction?: string; item?: { ts?: string } };

export function shouldProcess(event: ReactionEvent, config: { emojis: string[]; botUserId: string }): boolean {
  return event.type === "reaction_added"
    && Boolean(event.reaction && config.emojis.includes(event.reaction))
    && Boolean(event.user && event.user !== config.botUserId)
    && Boolean(event.item?.ts);
}
