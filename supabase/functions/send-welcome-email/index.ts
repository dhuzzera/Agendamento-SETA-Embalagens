import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";
    const SITE_URL = Deno.env.get("SITE_URL") || "https://agendamento-seta-embalagens.vercel.app";

    const html = "<h2>Bem-vindo à SETA Embalagens!</h2>" +
      "<p>Olá " + payload.fullName.split(" ")[0] + ",</p>" +
      "<p>Sua conta no sistema de agendamento foi criada. Aqui estão suas credenciais de acesso:</p>" +
      "<table style='border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;width:100%;max-width:400px;'>" +
      "<tr style='background:#f9fafb;'><td style='padding:12px 16px;font-weight:600;color:#374151;'>E-mail</td><td style='padding:12px 16px;'>" + payload.email + "</td></tr>" +
      "<tr><td style='padding:12px 16px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;'>Senha provisória</td><td style='padding:12px 16px;border-top:1px solid #e5e7eb;font-family:monospace;'>" + payload.password + "</td></tr>" +
      "</table>" +
      "<p style='margin-top:24px;'><a href='" + SITE_URL + "/login' style='display:inline-block;padding:12px 24px;background:#1a3264;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;'>Acessar o sistema</a></p>" +
      "<p style='margin-top:16px;color:#6b7280;font-size:14px;'>No primeiro acesso você será solicitado a trocar a senha provisória por uma senha pessoal.</p>" +
      "<p style='margin-top:24px;color:#9ca3af;font-size:12px;'>SETA Embalagens — Sistema de Agendamento Comercial</p>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SETA Embalagens <" + FROM_EMAIL + ">",
        to: [payload.email],
        subject: "Bem-vindo à SETA Embalagens — Suas credenciais de acesso",
        html: html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error("Resend: " + err);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
