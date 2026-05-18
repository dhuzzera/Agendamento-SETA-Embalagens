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
      return new Response("<h1>Link inválido</h1>", {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, status, representative_id")
      .eq("id", token)
      .maybeSingle();

    if (!appt) {
      return new Response("<h1>Agendamento não encontrado</h1>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Busca o slug do representante para redirecionar
    const { data: profile } = await supabase
      .from("profiles")
      .select("slug")
      .eq("id", appt.representative_id)
      .maybeSingle();

    const SITE_URL = Deno.env.get("SITE_URL") || "https://agendamento-seta-embalagens.vercel.app";
    const slug = profile?.slug;

    if (!slug) {
      return new Response("<h1>Representante não encontrado</h1>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Cancela o agendamento atual
    if (appt.status === "scheduled") {
      await supabase
        .from("appointments")
        .update({ status: "rescheduled" })
        .eq("id", token);
    }

    // Redireciona para a página de agendamento do representante
    const redirectUrl = SITE_URL + "/" + slug;

    const html = "<html><head><meta charset='UTF-8'><meta http-equiv='refresh' content='3;url=" + redirectUrl + "'><title>Reagendando...</title></head><body style='font-family:-apple-system,sans-serif;max-width:500px;margin:60px auto;text-align:center;padding:20px;'><div style='background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:32px;'><h1 style='color:#1d4ed8;font-size:24px;'>Reagendando...</h1><p style='color:#4b5563;margin-top:12px;'>Seu agendamento anterior foi marcado como remarcado. Você será redirecionado para escolher um novo horário.</p><p style='margin-top:16px;'><a href='" + redirectUrl + "' style='display:inline-block;padding:12px 24px;background:#1a3264;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;'>Escolher novo horário</a></p></div></body></html>";

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
