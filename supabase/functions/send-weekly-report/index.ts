import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmtDate = (d: string) => d.split("-").reverse().join("/");
const fmtTime = (t: string) => t.slice(0, 5);

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

    // Busca agendamentos com dados completos
    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, status, representative_id, client_id, meeting_type, feedback_rating, appointment_date, start_time, end_time")
      .gte("appointment_date", fromStr)
      .lte("appointment_date", toStr)
      .order("appointment_date")
      .order("start_time");

    const total = appointments?.length || 0;
    const completed = appointments?.filter((a) => a.status === "completed").length || 0;
    const cancelled = appointments?.filter((a) => a.status === "cancelled").length || 0;
    const scheduled = appointments?.filter((a) => a.status === "scheduled").length || 0;
    const presencial = appointments?.filter((a) => a.meeting_type === "presencial").length || 0;
    const online = total - presencial;

    // Busca representantes e clientes
    const repIds = [...new Set((appointments || []).map((a) => a.representative_id))];
    const clientIds = [...new Set((appointments || []).map((a) => a.client_id))];

    const [{ data: reps }, { data: clients }] = await Promise.all([
      repIds.length ? supabase.from("profiles").select("id, full_name").in("id", repIds) : { data: [] },
      clientIds.length ? supabase.from("clients").select("id, name, company").in("id", clientIds) : { data: [] },
    ]);

    const repMap = new Map((reps || []).map((r) => [r.id, r.full_name]));
    const clientMap = new Map((clients || []).map((c) => [c.id, { name: c.name, company: c.company }]));

    // Agrupamento por representante
    const byRep = new Map<string, { name: string; total: number; completed: number; cancelled: number }>();
    for (const a of appointments || []) {
      const repName = repMap.get(a.representative_id) || "—";
      const cur = byRep.get(a.representative_id) || { name: repName, total: 0, completed: 0, cancelled: 0 };
      cur.total++;
      if (a.status === "completed") cur.completed++;
      if (a.status === "cancelled") cur.cancelled++;
      byRep.set(a.representative_id, cur);
    }

    // Rating médio
    const ratings = (appointments || []).filter((a) => a.feedback_rating).map((a) => a.feedback_rating as number);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";

    // Busca admins
    const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (!adminRoles?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminIds = adminRoles.map((r) => r.user_id);
    const { data: adminProfiles } = await supabase.from("profiles").select("email").in("id", adminIds);
    const adminEmails = (adminProfiles || []).map((p) => p.email).filter(Boolean);
    if (!adminEmails.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No admin emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── HTML ────────────────────────────────────────────────────────────────
    const tdStyle = "padding:10px 14px;border:1px solid #e5e7eb;";
    const thStyle = "padding:10px 14px;border:1px solid #e5e7eb;background:#f3f4f6;font-weight:600;text-align:left;";

    // Tabela de resumo
    let html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;color:#111827;">
  <div style="background:#1a3264;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Relatório Semanal — SETA Embalagens</h1>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:14px;">Período: <b>${fmtDate(fromStr)}</b> a <b>${fmtDate(toStr)}</b></p>
  </div>
  <div style="background:#fff;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;">

    <h2 style="font-size:15px;color:#374151;margin:0 0 12px;">Resumo geral</h2>
    <table style="border-collapse:collapse;width:100%;max-width:420px;margin-bottom:24px;">
      <tr><td style="${tdStyle}">Total de agendamentos</td><td style="${tdStyle}text-align:center;font-size:18px;font-weight:700;">${total}</td></tr>
      <tr><td style="${tdStyle}">Concluídos</td><td style="${tdStyle}text-align:center;color:#16a34a;font-weight:600;">${completed}</td></tr>
      <tr><td style="${tdStyle}">Cancelados</td><td style="${tdStyle}text-align:center;color:#dc2626;font-weight:600;">${cancelled}</td></tr>
      <tr><td style="${tdStyle}">Pendentes</td><td style="${tdStyle}text-align:center;">${scheduled}</td></tr>
      <tr><td style="${tdStyle}">Online / Presencial</td><td style="${tdStyle}text-align:center;">${online} / ${presencial}</td></tr>
      <tr><td style="${tdStyle}">Avaliação média</td><td style="${tdStyle}text-align:center;font-weight:600;">${avgRating} / 5</td></tr>
    </table>`;

    // Por representante
    if (byRep.size > 0) {
      html += `<h2 style="font-size:15px;color:#374151;margin:0 0 12px;">Por representante</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
        <tr>
          <th style="${thStyle}">Representante</th>
          <th style="${thStyle}text-align:center;">Total</th>
          <th style="${thStyle}text-align:center;color:#16a34a;">Concluídos</th>
          <th style="${thStyle}text-align:center;color:#dc2626;">Cancelados</th>
        </tr>`;
      for (const [, rep] of byRep) {
        html += `<tr>
          <td style="${tdStyle}">${rep.name}</td>
          <td style="${tdStyle}text-align:center;font-weight:600;">${rep.total}</td>
          <td style="${tdStyle}text-align:center;color:#16a34a;">${rep.completed}</td>
          <td style="${tdStyle}text-align:center;color:#dc2626;">${rep.cancelled}</td>
        </tr>`;
      }
      html += `</table>`;
    }

    // Lista detalhada de agendamentos
    if (appointments && appointments.length > 0) {
      html += `<h2 style="font-size:15px;color:#374151;margin:0 0 12px;">Detalhamento dos agendamentos</h2>
      <table style="border-collapse:collapse;width:100%;margin-bottom:24px;font-size:13px;">
        <tr>
          <th style="${thStyle}">Data</th>
          <th style="${thStyle}">Horário</th>
          <th style="${thStyle}">Representante</th>
          <th style="${thStyle}">Cliente</th>
          <th style="${thStyle}">Empresa</th>
          <th style="${thStyle}">Modalidade</th>
          <th style="${thStyle}">Status</th>
        </tr>`;

      const statusLabel: Record<string, string> = {
        scheduled: "Agendado",
        completed: "Concluído",
        cancelled: "Cancelado",
        rescheduled: "Remarcado",
      };
      const statusColor: Record<string, string> = {
        scheduled: "#2563eb",
        completed: "#16a34a",
        cancelled: "#dc2626",
        rescheduled: "#d97706",
      };

      for (const a of appointments) {
        const client = clientMap.get(a.client_id);
        const repName = repMap.get(a.representative_id) || "—";
        const color = statusColor[a.status] || "#6b7280";
        html += `<tr>
          <td style="${tdStyle}">${fmtDate(a.appointment_date)}</td>
          <td style="${tdStyle}">${fmtTime(a.start_time)} – ${fmtTime(a.end_time)}</td>
          <td style="${tdStyle}">${repName}</td>
          <td style="${tdStyle}">${client?.name || "—"}</td>
          <td style="${tdStyle}">${client?.company || "—"}</td>
          <td style="${tdStyle}">${a.meeting_type === "presencial" ? "Presencial" : "Online"}</td>
          <td style="${tdStyle}color:${color};font-weight:600;">${statusLabel[a.status] || a.status}</td>
        </tr>`;
      }
      html += `</table>`;
    }

    html += `
    <p style="color:#6b7280;font-size:12px;margin-top:8px;">Acesse o painel para mais detalhes e exportar relatórios.</p>
  </div>
  <div style="background:#f9fafb;padding:12px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#9ca3af;font-size:11px;margin:0;">SETA Embalagens — Relatório automático semanal.</p>
  </div>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SETA Embalagens <" + FROM_EMAIL + ">",
        to: adminEmails,
        subject: "Relatório Semanal — " + fmtDate(fromStr) + " a " + fmtDate(toStr),
        html,
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
