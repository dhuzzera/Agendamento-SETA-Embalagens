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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("<h1>Link inválido</h1><p>Token não fornecido.</p>", {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Token = appointment ID (UUID) — simples e funcional
    const { data: appt, error } = await supabase
      .from("appointments")
      .select("id, status, appointment_date, start_time, representative_id")
      .eq("id", token)
      .maybeSingle();

    if (error || !appt) {
      return new Response("<h1>Agendamento não encontrado</h1><p>Este link pode ter expirado ou o agendamento já foi removido.</p>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (appt.status === "cancelled") {
      return new Response("<html><body style='font-family:sans-serif;max-width:500px;margin:60px auto;text-align:center;'><h1>Já cancelado</h1><p>Este agendamento já foi cancelado anteriormente.</p></body></html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Cancela o agendamento
    const { error: updateErr } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", token);

    if (updateErr) {
      return new Response("<h1>Erro</h1><p>Não foi possível cancelar. Tente novamente.</p>", {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const html = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Agendamento Cancelado</title></head><body style='font-family:-apple-system,sans-serif;max-width:500px;margin:60px auto;text-align:center;padding:20px;'><div style='background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:32px;'><h1 style='color:#dc2626;font-size:24px;'>Agendamento cancelado</h1><p style='color:#4b5563;margin-top:12px;'>Seu agendamento do dia <b>" + appt.appointment_date.split("-").reverse().join("/") + "</b> às <b>" + appt.start_time.slice(0, 5) + "</b> foi cancelado com sucesso.</p><p style='color:#6b7280;margin-top:16px;font-size:14px;'>O representante será notificado automaticamente.</p></div><p style='margin-top:24px;color:#9ca3af;font-size:12px;'>SETA Embalagens</p></body></html>";

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return new Response("<h1>Erro interno</h1>", {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
