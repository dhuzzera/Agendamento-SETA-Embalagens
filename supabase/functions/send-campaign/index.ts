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

    const { campaignId } = await req.json();
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca a campanha
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (campaign.status === "sent") {
      return new Response(JSON.stringify({ error: "Campaign already sent" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca destinatários
    let recipients: { name: string; email: string; company: string | null }[] = [];

    if (campaign.list_id) {
      // Busca membros da lista
      const { data: members } = await supabase
        .from("contact_list_members")
        .select("client_id")
        .eq("list_id", campaign.list_id);

      if (members?.length) {
        const clientIds = members.map((m) => m.client_id);
        const { data: clients } = await supabase
          .from("clients")
          .select("name, email, company")
          .in("id", clientIds);
        recipients = (clients ?? []).filter((c) => c.email && !c.email.includes("@importado.local"));
      }
    } else {
      // Sem lista: envia pra todos os contatos com e-mail válido
      const { data: clients } = await supabase
        .from("clients")
        .select("name, email, company")
        .not("email", "ilike", "%@importado.local%")
        .limit(500);
      recipients = clients ?? [];
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients found", sent: 0 }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marca como enviando
    await supabase.from("campaigns").update({
      status: "sending",
      total_recipients: recipients.length,
    }).eq("id", campaignId);

    let sent = 0;

    for (const recipient of recipients) {
      // Substitui variáveis no HTML
      let html = campaign.html_body;
      html = html.replace(/\{\{nome\}\}/gi, recipient.name.split(" ")[0]);
      html = html.replace(/\{\{nome_completo\}\}/gi, recipient.name);
      html = html.replace(/\{\{empresa\}\}/gi, recipient.company ?? "");
      html = html.replace(/\{\{email\}\}/gi, recipient.email);

      let subject = campaign.subject;
      subject = subject.replace(/\{\{nome\}\}/gi, recipient.name.split(" ")[0]);
      subject = subject.replace(/\{\{empresa\}\}/gi, recipient.company ?? "");

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + RESEND_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "SETA Embalagens <" + FROM_EMAIL + ">",
            to: [recipient.email],
            subject: subject,
            html: html,
          }),
        });

        if (res.ok) sent++;
      } catch {
        // Continue with next recipient
      }
    }

    // Atualiza campanha como enviada
    await supabase.from("campaigns").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      total_sent: sent,
      total_recipients: recipients.length,
    }).eq("id", campaignId);

    return new Response(JSON.stringify({ sent, total: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
