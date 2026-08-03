import { rectSlots, type Cell, type ParticipantView } from "@/lib/meeting-poll";

export interface AvailabilityDrag {
  mode: "paint" | "erase";
  anchor: Cell;
  cursor: Cell;
}

export function draftAvailability(
  mine: Set<string>,
  drag: AvailabilityDrag | null,
  dates: string[],
  times: string[],
): Set<string> {
  if (!drag) return mine;
  const next = new Set(mine);
  for (const slot of rectSlots(dates, times, drag.anchor, drag.cursor)) {
    if (drag.mode === "paint") next.add(slot);
    else next.delete(slot);
  }
  return next;
}

export function availabilityViews(
  views: ParticipantView[],
  participantId: string | null,
  draft: Set<string>,
  markSelectedResponded: boolean,
): ParticipantView[] {
  return views.map((view) =>
    view.id === participantId
      ? { ...view, slots: draft, responded: markSelectedResponded || view.responded || draft.size > 0 }
      : view,
  );
}
