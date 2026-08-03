import { nextDayKey } from "@/lib/calendar";
import { dateWithWeekday, MAX_POLL_DAYS } from "@/lib/meeting-poll";

export interface PollDraftPerson {
  key: string;
  participantId: string | null;
  name: string;
  userId: string | null;
  email: string | null;
}

export function defaultPollDates(today: string): string[] {
  const dates = [today];
  for (let index = 0; index < 6; index++) dates.push(nextDayKey(dates[dates.length - 1]));
  return dates;
}

export function togglePollDate(dates: string[], dateKey: string): string[] {
  if (dates.includes(dateKey)) return dates.filter((date) => date !== dateKey);
  return dates.length >= MAX_POLL_DAYS ? dates : [...dates, dateKey];
}

export function addPollDraftPerson(
  people: PollDraftPerson[],
  value: string,
  staff: { id: string; name: string }[],
): PollDraftPerson[] {
  const name = value.trim();
  if (!name) return people;
  const member = staff.find((person) => person.name === name && !people.some((picked) => picked.userId === person.id));
  const email = name.includes("@") ? name : null;
  return [...people, member ? { key: member.id, participantId: null, name: member.name, userId: member.id, email: null } : {
    key: `guest-${name}-${people.length}`, participantId: null, name: email ? name.split("@")[0] : name, userId: null, email,
  }];
}

export function dueAtEnd(dateKey: string): string {
  return `${dateKey}T23:59:59+09:00`;
}

export function pollDueOptions(today: string, dates: string[]) {
  const options = [{ value: "", label: "마감 없음" }];
  const last = dates.at(-1);
  if (!last) return options;
  for (let day = today; day <= last && options.length <= 15; day = nextDayKey(day)) {
    options.push({ value: dueAtEnd(day), label: `${dateWithWeekday(day)} 자정` });
  }
  return options;
}
