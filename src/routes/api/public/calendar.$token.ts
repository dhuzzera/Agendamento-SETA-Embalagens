import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SP_TZID = "America/Sao_Paulo";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Floating local stamp YYYYMMDDTHHmmss (used with TZID=America/Sao_Paulo). */
function toLocalStamp(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  return (
    `${y}${pad(m ?? 1)}${pad(d ?? 1)}` +
    `T${pad(hh ?? 0)}${pad(mm ?? 0)}${pad(ss ?? 0)}`
  );
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function nowStampUtc(): string {
  const d = new Date();
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

export const Route = createFileRoute("/api/public/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = params.token ?? "";
        const token = raw.replace(/\.ics$/i, "");

        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRe.test(token)) {
          return new Response("Not found", { status: 404 });
        }

        const { data: profile, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .eq("calendar_token", token)
          .maybeSingle();

        if (pErr || !profile) {
          return new Response("Not found", { status: 404 });
        }

        const { data: appts } = await supabaseAdmin
          .from("appointments")
          .select(
            "id, appointment_date, start_time, end_time, status, notes, meeting_type, location, client_id, updated_at"
          )
          .eq("representative_id", profile.id)
          .in("status", ["scheduled", "rescheduled", "completed"])
          .order("appointment_date", { ascending: true });

        const list = appts ?? [];
        const clientIds = [...new Set(list.map((a) => a.client_id))];
        const { data: clients } = clientIds.length
          ? await supabaseAdmin
              .from("clients")
              .select("id, name, company, email, phone")
              .in("id", clientIds)
          : { data: [] as Array<{
              id: string;
              name: string;
              company: string | null;
              email: string;
              phone: string | null;
            }> };
        const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

        const stamp = nowStampUtc();
        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Seta Embalagens//Agendamento//PT-BR",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          `X-WR-CALNAME:${escapeIcs(`Agenda Seta — ${profile.full_name}`)}`,
          `X-WR-TIMEZONE:${SP_TZID}`,
          "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
          "X-PUBLISHED-TTL:PT30M",
          ...SP_VTIMEZONE,
        ];

        for (const a of list) {
          const c = clientMap.get(a.client_id);
          const clientLabel = c
            ? `${c.name}${c.company ? ` (${c.company})` : ""}`
            : "Cliente";
          const summary =
            a.status === "cancelled"
              ? `[CANCELADA] Reunião — ${clientLabel}`
              : `Reunião — ${clientLabel}`;
          const descParts = [];
          if (c?.email) descParts.push(`E-mail: ${c.email}`);
          if (c?.phone) descParts.push(`Telefone: ${c.phone}`);
          if (a.notes) descParts.push(`Observações: ${a.notes}`);
          descParts.push(`Status: ${a.status}`);

          lines.push(
            "BEGIN:VEVENT",
            `UID:appointment-${a.id}@seta-agende`,
            `DTSTAMP:${stamp}`,
            `DTSTART;TZID=${SP_TZID}:${toLocalStamp(a.appointment_date, a.start_time)}`,
            `DTEND;TZID=${SP_TZID}:${toLocalStamp(a.appointment_date, a.end_time)}`,
            `SUMMARY:${escapeIcs(summary)}`,
            `DESCRIPTION:${escapeIcs(descParts.join("\n"))}`,
            a.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
            "END:VEVENT",
          );
        }
        lines.push("END:VCALENDAR");

        return new Response(lines.join("\r\n"), {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": `inline; filename="agenda-seta.ics"`,
          },
        });
      },
    },
  },
});
