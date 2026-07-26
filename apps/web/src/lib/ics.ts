import { zonedDateKey } from "~/lib/zoned-time";

/**
 * A single event as an iCalendar file (RFC 5545), hand-written rather than
 * pulled from a library: one VEVENT is a dozen lines, and the rules that matter
 * here — CRLF endings, escaped text, folded long lines — are the whole of it.
 *
 * Timed events are written as UTC instants, so no importing calendar has to
 * agree with us about timezone databases. All-day events are written as dates
 * in the city's own zone, because "all day" is a statement about the local day,
 * and DTEND is the day after the last one (RFC 5545 §3.6.1: it is exclusive).
 */
export interface IcsEvent {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  /** The organisation hosting it, used as the calendar entry's organiser name. */
  hostName: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timeZone: string;
  cancelled: boolean;
  /** The event's own page, so a calendar entry can lead back to the source. */
  url: string | null;
  /** When the record last changed, so a re-import updates rather than duplicates. */
  stamp: Date;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** `20260729T120000Z` — the instant, in UTC. */
function utcStamp(instant: Date) {
  return (
    `${String(instant.getUTCFullYear())}${pad(instant.getUTCMonth() + 1)}${pad(instant.getUTCDate())}` +
    `T${pad(instant.getUTCHours())}${pad(instant.getUTCMinutes())}${pad(instant.getUTCSeconds())}Z`
  );
}

/** `20260729` — a calendar day in the event's own city. */
function dateStamp(instant: Date, timeZone: string) {
  return zonedDateKey(instant, timeZone).replaceAll("-", "");
}

function nextDay(instant: Date, timeZone: string) {
  const key = zonedDateKey(instant, timeZone);
  const day = new Date(`${key}T00:00:00Z`);
  return dateStamp(new Date(day.getTime() + 86_400_000), "UTC");
}

/** RFC 5545 §3.3.11: commas, semicolons, backslashes and newlines are escaped. */
function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r\n|\r|\n/g, "\\n");
}

/**
 * A parameter value, always quoted: an organisation name holding a comma,
 * semicolon or colon would otherwise end the parameter early. Double quotes
 * cannot be escaped inside a quoted string, so they become single ones.
 */
function quoteParameter(value: string) {
  return `"${value.replaceAll('"', "'")}"`;
}

/**
 * Lines are folded at 75 octets with a leading space on continuations. Measured
 * in bytes, not characters: an Arabic description is two bytes a letter, and a
 * fold inside a character breaks the file.
 */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  let size = 0;
  const limit = () => (chunks.length === 0 ? 75 : 74);
  for (const character of line) {
    const width = new TextEncoder().encode(character).length;
    if (size + width > limit()) {
      chunks.push(current);
      current = "";
      size = 0;
    }
    current += character;
    size += width;
  }
  if (current !== "") chunks.push(current);
  return chunks.join("\r\n ");
}

export function eventToIcs(event: IcsEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//InfoKit//Coordination agenda//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(event.stamp)}`,
    event.allDay
      ? `DTSTART;VALUE=DATE:${dateStamp(event.startsAt, event.timeZone)}`
      : `DTSTART:${utcStamp(event.startsAt)}`,
    event.allDay
      ? `DTEND;VALUE=DATE:${nextDay(event.endsAt, event.timeZone)}`
      : `DTEND:${utcStamp(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "SEQUENCE:0",
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.hostName) {
    // Parameter values quote rather than backslash-escape (RFC 5545 §3.1), and
    // the value has to be a real URI: `MAILTO:noreply` is not one, and a
    // calendar that validates it rejects the whole file. `invalid:nomail` is
    // the convention for an organiser with no address.
    lines.push(`ORGANIZER;CN=${quoteParameter(event.hostName)}:invalid:nomail`);
  }
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** A filename a phone will hand to its calendar app rather than a text editor. */
export function icsFileName(title: string) {
  const slug =
    title
      .toLocaleLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "")
      .slice(0, 60) || "event";
  return `${slug}.ics`;
}
