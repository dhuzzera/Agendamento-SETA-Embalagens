import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env not set");

    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca agendamentos de amanhã que ainda estão scheduled
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, appointment_date, start_time, end_time, meeting_type, location, city, state, representative_id, client_id")
      .eq("appointment_date", tomorrowStr)
      .eq("status", "scheduled");

    if (error) throw error;
    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No appointments tomorrow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca clientes e representantes
    const clientIds = [...new Set(appointments.map((a) => a.client_id))];
    const repIds = [...new Set(appointments.map((a) => a.representative_id))];

    const [{ data: clients }, { data: reps }] = await Promise.all([
      supabase.from("clients").select("id, name, email").in("id", clientIds),
      supabase.from("profiles").select("id, full_name").in("id", repIds),
    ]);

    const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
    const repMap = new Map((reps ?? []).map((r) => [r.id, r.full_name]));

    const weekdays = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
    const [year, month, day] = tomorrowStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const months = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const dateFormatted = weekdays[dateObj.getDay()] + ", " + day + " de " + months[month - 1] + " de " + year;

    let sent = 0;

    for (const appt of appointments) {
      const client = clientMap.get(appt.client_id);
      if (!client || !client.email) continue;

      const repName = repMap.get(appt.representative_id) || "seu representante";
      const startF = appt.start_time.slice(0, 5);
      const modalidade = appt.meeting_type === "presencial" ? "Presencial" : "Online";

      const html = "<h2>Lembrete: sua reunião é amanhã!</h2>" +
        "<p>Olá " + client.name.split(" ")[0] + ",</p>" +
        "<p>Este é um lembrete da sua reunião agendada para <b>amanhã</b>:</p>" +
        "<ul>" +
        "<li><b>Representante:</b> " + repName + "</li>" +
        "<li><b>Data:</b> " + dateFormatted + "</li>" +
        "<li><b>Horário:</b> " + startF + "</li>" +
        "<li><b>Modalidade:</b> " + modalidade + "</li>" +
        (appt.city ? "<li><b>Cidade:</b> " + appt.city + (appt.state ? " - " + appt.state : "") + "</li>" : "") +
        (appt.location ? "<li><b>Local:</b> " + appt.location + "</li>" : "") +
        "</ul>" +
        "<p style='margin-top:16px;color:#6b7280;font-size:14px;'>Precisa cancelar ou reagendar? Entre em contato diretamente com o representante " + repName + ".</p>" +
        "<p style='margin-top:16px;color:#9ca3af;font-size:12px;'>SETA Embalagens — E-mail automático, não responda.</p>";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SETA Embalagens <" + FROM_EMAIL + ">",
          to: [client.email],
          subject: "Lembrete: reunião amanhã às " + startF + " com " + repName,
          html: html,
        }),
      });

      if (res.ok) sent++;
    }

    return new Response(JSON.stringify({ sent, total: appointments.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
