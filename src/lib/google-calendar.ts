import { getGoogleAccessToken } from "@/lib/google-meet";

type CalendarEventParams = {
  slotId: string;
  calendarEventId: string | null;
  season: string;
  startsAt: string;
  durationMin: number;
  applicantName: string;
  meetUri: string;
  attendeeEmails: string[];
};

function eventIdFor(slotId: string) {
  return `gdgdju${slotId.replaceAll("-", "")}`;
}

function eventBody(params: CalendarEventParams) {
  const endsAt = new Date(new Date(params.startsAt).getTime() + params.durationMin * 60_000);
  const attendeeEmails = [...new Set(params.attendeeEmails.filter(Boolean))];

  return {
    id: eventIdFor(params.slotId),
    summary: `[GDGOC DJU] ${params.season} 면접 · ${params.applicantName}`,
    description: `Google Meet: ${params.meetUri}`,
    location: params.meetUri,
    start: { dateTime: params.startsAt, timeZone: "Asia/Seoul" },
    end: { dateTime: endsAt.toISOString(), timeZone: "Asia/Seoul" },
    attendees: attendeeEmails.map((email) => ({ email })),
  };
}

export async function syncInterviewCalendarEvent(
  params: CalendarEventParams,
): Promise<{ eventId: string }> {
  const accessToken = await getGoogleAccessToken();
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID ?? "primary");
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
  const eventId = params.calendarEventId ?? eventIdFor(params.slotId);
  const body = JSON.stringify(eventBody(params));
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let response = await fetch(
    params.calendarEventId ? `${baseUrl}/${encodeURIComponent(eventId)}?sendUpdates=all` : `${baseUrl}?sendUpdates=all`,
    {
      method: params.calendarEventId ? "PATCH" : "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    },
  );

  if ((!params.calendarEventId && response.status === 409) || (params.calendarEventId && response.status === 404)) {
    response = await fetch(`${baseUrl}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: params.calendarEventId ? "POST" : "PATCH",
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });
  }

  if (!response.ok) throw new Error("GOOGLE_CALENDAR_EVENT_FAILED");

  const event = (await response.json()) as { id?: string };
  if (!event.id) throw new Error("GOOGLE_CALENDAR_EVENT_FAILED");
  return { eventId: event.id };
}
