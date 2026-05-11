// Calendar helpers for "add to calendar" links and .ics file generation.
// All times are interpreted as America/Sao_Paulo (BRT, UTC-3, no DST since 2019)
// regardless of the user's device timezone.

export type CalendarEvent = {
  title: string;
  description?: string;
  location?: string;
  /** Local date in YYYY-MM-DD (America/Sao_Paulo) */
  date: string;
  /** Local time HH:mm or HH:mm:ss (America/Sao_Paulo) */
  startTime: string;
  /** Local time HH:mm or HH:mm:ss (America/Sao_Paulo) */
  endTime: string;
  organizerEmail?: string;
  organizerName?: string;
  attendeeEmail?: string;
  attendeeName?: string;
  /** Stable identifier (e.g. appointment id). Used as ICS UID. */
  uid?: string;
};

const SP_TZID = "America/Sao_Paulo";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Format date+time as floating local stamp YYYYMMDDTHHmmss (no Z, used with TZID). */
function toLocalStamp(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  return (
    `${y}${pad(m ?? 1)}${pad(d ?? 1)}` +
    `T${pad(hh ?? 0)}${pad(mm ?? 0)}${pad(ss ?? 0)}`
  );
}

/** Format a Date as a UTC stamp YYYYMMDDTHHmmssZ. */
function dateToUtcStamp(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Convert a São Paulo wall-clock date/time to a UTC stamp YYYYMMDDTHHmmssZ.
 * Brazil has no DST since 2019 → fixed UTC-3 offset, so we add 3h.
 */
export function spToUtcStamp(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  // SP is UTC-3 → UTC = SP + 3h. Build the UTC instant directly.
  const utc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, (hh ?? 0) + 3, mm ?? 0, ss));
  return dateToUtcStamp(utc);
}

/** VTIMEZONE block for America/Sao_Paulo (no DST since 2019, fixed UTC-3). */
const SP_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${SP_TZID}`,
  "X-LIC-LOCATION:America/Sao_Paulo",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:-0300",
  "TZOFFSETTO:-0300",
  "TZNAME:-03",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Build a Google Calendar "create event" URL. */
export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  // Google accepts UTC stamps with Z suffix.
  const start = spToUtcStamp(event.date, event.startTime);
  const end = spToUtcStamp(event.date, event.endTime);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    ctz: SP_TZID,
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

/** Build a .ics calendar file body (RFC 5545) anchored to America/Sao_Paulo. */
export function buildIcsContent(event: CalendarEvent): string {
  const start = toLocalStamp(event.date, event.startTime);
  const end = toLocalStamp(event.date, event.endTime);
  const stamp = dateToUtcStamp(new Date());
  const uid =
    event.uid ?? `${stamp}-${Math.random().toString(36).slice(2)}@seta-agende`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SETA Embalagens//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${SP_TZID}`,
    ...SP_VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${SP_TZID}:${start}`,
    `DTEND;TZID=${SP_TZID}:${end}`,
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
