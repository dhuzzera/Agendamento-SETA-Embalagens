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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca agendamentos de hoje que ja passaram (end_time < agora)
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 8);

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, appointment_date, start_time, end_time, representative_id, client_id, status")
      .eq("appointment_date", todayStr)
      .eq("status", "scheduled")
      .lt("end_time", currentTime);

    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIds = [...new Set(appointments.map((a) => a.client_id))];
    const repIds = [...new Set(appointments.map((a) => a.representative_id))];

    const [{ data: clients }, { data: reps }] = await Promise.all([
      supabase.from("clients").select("id, name, email").in("id", clientIds),
      supabase.from("profiles").select("id, full_name").in("id", repIds),
    ]);

    const clientMap = new Map((clients || []).map((c) => [c.id, c]));
    const repMap = new Map((reps || []).map((r) => [r.id, r.full_name]));

    let sent = 0;

    for (const appt of appointments) {
      const client = clientMap.get(appt.client_id);
      if (!client || !client.email) continue;

      const repName = repMap.get(appt.representative_id) || "seu representante";
      const feedbackUrl = SUPABASE_URL + "/functions/v1/submit-feedback?token=" + appt.id;

      const html = "<h2>Como foi sua reuniao?</h2>" +
        "<p>Ola " + client.name.split(" ")[0] + ",</p>" +
        "<p>Sua reuniao com <b>" + repName + "</b> acabou de acontecer. Como voce avalia o atendimento?</p>" +
        "<div style='margin:24px 0;text-align:center;'>" +
        "<a href='" + feedbackUrl + "&rating=5' style='font-size:32px;text-decoration:none;margin:0 4px;'>⭐</a>" +
        "<a href='" + feedbackUrl + "&rating=4' style='font-size:32px;text-decoration:none;margin:0 4px;'>⭐</a>" +
        "<a href='" + feedbackUrl + "&rating=3' style='font-size:32px;text-decoration:none;margin:0 4px;'>⭐</a>" +
        "<a href='" + feedbackUrl + "&rating=2' style='font-size:32px;text-decoration:none;margin:0 4px;'>⭐</a>" +
        "<a href='" + feedbackUrl + "&rating=1' style='font-size:32px;text-decoration:none;margin:0 4px;'>⭐</a>" +
        "</div>" +
        "<p style='text-align:center;color:#6b7280;font-size:13px;'>Clique na quantidade de estrelas que representa sua experiencia (5 = excelente, 1 = ruim)</p>" +
        "<p style='margin-top:24px;color:#9ca3af;font-size:12px;'>SETA Embalagens - E-mail automatico.</p>";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SETA Embalagens <" + FROM_EMAIL + ">",
          to: [client.email],
          subject: "Como foi sua reuniao com " + repName + "?",
          html: html,
        }),
      });

      if (res.ok) {
        sent++;
        // Marca como completed
        await supabase.from("appointments").update({ status: "completed" }).eq("id", appt.id);
      }
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
