// Calendar helpers for "add to calendar" links and .ics file generation.
// Pure client-side: works for Google Calendar, Apple Calendar, Outlook, etc.

export type CalendarEvent = {
  title: string;
  description?: string;
  location?: string;
  /** Local date in YYYY-MM-DD (no timezone) */
  date: string;
  /** Local time HH:mm or HH:mm:ss */
  startTime: string;
  /** Local time HH:mm or HH:mm:ss */
  endTime: string;
  /** Optional organizer email (for ICS) */
  organizerEmail?: string;
  organizerName?: string;
  /** Optional attendee email (for ICS) */
  attendeeEmail?: string;
  attendeeName?: string;
  /** Stable identifier (e.g. appointment id). Used as ICS UID. */
  uid?: string;
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Convert a local date/time pair into a UTC string formatted as YYYYMMDDTHHmmssZ. */
function toUtcStamp(date: string, time: string): string {
  // Build a Date treating the inputs as the user's local time.
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, ss);
  return (
    local.getUTCFullYear().toString() +
    pad(local.getUTCMonth() + 1) +
    pad(local.getUTCDate()) +
    "T" +
    pad(local.getUTCHours()) +
    pad(local.getUTCMinutes()) +
    pad(local.getUTCSeconds()) +
    "Z"
  );
}

/** Build a Google Calendar "create event" URL. */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const start = toUtcStamp(event.date, event.startTime);
  const end = toUtcStamp(event.date, event.endTime);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Build a .ics calendar file body (RFC 5545). */
export function buildIcsContent(event: CalendarEvent): string {
  const start = toUtcStamp(event.date, event.startTime);
  const end = toUtcStamp(event.date, event.endTime);
  const stamp = toUtcStamp(
    new Date().toISOString().slice(0, 10),
    new Date().toISOString().slice(11, 19)
  );
  const uid = event.uid ?? `${stamp}-${Math.random().toString(36).slice(2)}@seta-agende`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Seta Embalagens//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  if (event.organizerEmail) {
    const cn = event.organizerName ? `;CN=${escapeIcs(event.organizerName)}` : "";
    lines.push(`ORGANIZER${cn}:mailto:${event.organizerEmail}`);
  }
  if (event.attendeeEmail) {
    const cn = event.attendeeName ? `;CN=${escapeIcs(event.attendeeName)}` : "";
    lines.push(
      `ATTENDEE${cn};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${event.attendeeEmail}`
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Trigger a browser download of an .ics file. */
export function downloadIcsFile(event: CalendarEvent, filename = "reuniao.ics"): void {
  const blob = new Blob([buildIcsContent(event)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
