import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toUtcStamp(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  // Treat the stored date/time as local Brazil time (no timezone column today).
  // We emit UTC, so the receiving calendar will display the right wall time.
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

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function nowStamp() {
  const iso = new Date().toISOString();
  return toUtcStamp(iso.slice(0, 10), iso.slice(11, 19));
}

export const Route = createFileRoute("/api/public/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // Allow ".ics" suffix for friendlier URLs.
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
            "id, appointment_date, start_time, end_time, status, notes, client_id, updated_at"
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
        const clientMap = new Map(
          (clients ?? []).map((c) => [c.id, c]),
        );

        const stamp = nowStamp();
        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Seta Embalagens//Agendamento//PT-BR",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          `X-WR-CALNAME:${escapeIcs(`Agenda Seta — ${profile.full_name}`)}`,
          "X-WR-TIMEZONE:America/Sao_Paulo",
          "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
          "X-PUBLISHED-TTL:PT30M",
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
            `DTSTART:${toUtcStamp(a.appointment_date, a.start_time)}`,
            `DTEND:${toUtcStamp(a.appointment_date, a.end_time)}`,
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
