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

    // Semana passada (segunda a domingo)
    const now = new Date();
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - now.getDay() - 6);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    const fromStr = lastMonday.toISOString().slice(0, 10);
    const toStr = lastSunday.toISOString().slice(0, 10);

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, status, representative_id, meeting_type, feedback_rating")
      .gte("appointment_date", fromStr)
      .lte("appointment_date", toStr);

    const total = appointments?.length || 0;
    const completed = appointments?.filter((a) => a.status === "completed").length || 0;
    const cancelled = appointments?.filter((a) => a.status === "cancelled").length || 0;
    const scheduled = appointments?.filter((a) => a.status === "scheduled").length || 0;
    const presencial = appointments?.filter((a) => a.meeting_type === "presencial").length || 0;
    const online = total - presencial;

    // NPS/Rating medio
    const ratings = (appointments || []).filter((a) => a.feedback_rating).map((a) => a.feedback_rating as number);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";

    // Busca admins para enviar o relatorio
    const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (!adminRoles?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminIds = adminRoles.map((r) => r.user_id);
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("email")
      .in("id", adminIds);

    const adminEmails = (adminProfiles || []).map((p) => p.email).filter(Boolean);
    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No admin emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = "<h2>Relatorio Semanal - SETA Embalagens</h2>" +
      "<p>Periodo: <b>" + fromStr.split("-").reverse().join("/") + "</b> a <b>" + toStr.split("-").reverse().join("/") + "</b></p>" +
      "<table style='border-collapse:collapse;width:100%;max-width:400px;margin:16px 0;'>" +
      "<tr style='background:#f9fafb;'><td style='padding:10px 16px;border:1px solid #e5e7eb;font-weight:600;'>Total de agendamentos</td><td style='padding:10px 16px;border:1px solid #e5e7eb;text-align:center;font-size:20px;font-weight:700;'>" + total + "</td></tr>" +
      "<tr><td style='padding:10px 16px;border:1px solid #e5e7eb;'>Concluidos</td><td style='padding:10px 16px;border:1px solid #e5e7eb;text-align:center;color:#16a34a;font-weight:600;'>" + completed + "</td></tr>" +
      "<tr style='background:#f9fafb;'><td style='padding:10px 16px;border:1px solid #e5e7eb;'>Cancelados</td><td style='padding:10px 16px;border:1px solid #e5e7eb;text-align:center;color:#dc2626;font-weight:600;'>" + cancelled + "</td></tr>" +
      "<tr><td style='padding:10px 16px;border:1px solid #e5e7eb;'>Pendentes</td><td style='padding:10px 16px;border:1px solid #e5e7eb;text-align:center;'>" + scheduled + "</td></tr>" +
      "<tr style='background:#f9fafb;'><td style='padding:10px 16px;border:1px solid #e5e7eb;'>Online / Presencial</td><td style='padding:10px 16px;border:1px solid #e5e7eb;text-align:center;'>" + online + " / " + presencial + "</td></tr>" +
      "<tr><td style='padding:10px 16px;border:1px solid #e5e7eb;'>Avaliacao media</td><td style='padding:10px 16px;border:1px solid #e5e7eb;text-align:center;font-weight:600;'>" + avgRating + " / 5</td></tr>" +
      "</table>" +
      "<p style='color:#6b7280;font-size:13px;'>Acesse o painel para mais detalhes.</p>" +
      "<p style='margin-top:24px;color:#9ca3af;font-size:12px;'>SETA Embalagens - Relatorio automatico semanal.</p>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SETA Embalagens <" + FROM_EMAIL + ">",
        to: adminEmails,
        subject: "Relatorio Semanal - " + fromStr.split("-").reverse().join("/") + " a " + toStr.split("-").reverse().join("/"),
        html: html,
      }),
    });

    return new Response(JSON.stringify({ sent: res.ok ? adminEmails.length : 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
