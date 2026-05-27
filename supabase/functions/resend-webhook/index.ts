import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const eventType = body.type as string;
    const data = body.data as {
      email_id?: string;
      to?: string[];
      subject?: string;
      created_at?: string;
      tags?: { name: string; value: string }[];
    };

    // Extrair campaign_id das tags (adicionamos na hora do envio)
    const campaignTag = data.tags?.find((t) => t.name === "campaign_id");
    const campaignId = campaignTag?.value;

    if (!campaignId) {
      // Sem campaign_id, não é um e-mail de campanha — ignora
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualiza contadores baseado no tipo de evento
    switch (eventType) {
      case "email.delivered": {
        // Incrementa total_sent (entregue com sucesso)
        await supabase.rpc("increment_campaign_counter", {
          p_campaign_id: campaignId,
          p_field: "total_sent",
        });
        break;
      }

      case "email.opened": {
        // Incrementa total_opened
        await supabase.rpc("increment_campaign_counter", {
          p_campaign_id: campaignId,
          p_field: "total_opened",
        });

        // Atualiza lead score do contato
        const email = data.to?.[0];
        if (email) {
          await supabase.rpc("increment_lead_score", {
            p_email: email,
            p_points: 5,
          });
        }
        break;
      }

      case "email.clicked": {
        // Incrementa total_clicked
        await supabase.rpc("increment_campaign_counter", {
          p_campaign_id: campaignId,
          p_field: "total_clicked",
        });

        // Atualiza lead score
        const email = data.to?.[0];
        if (email) {
          await supabase.rpc("increment_lead_score", {
            p_email: email,
            p_points: 10,
          });
        }
        break;
      }

      case "email.bounced":
      case "email.complained": {
        // Poderia marcar o contato como inválido
        break;
      }
    }

    return new Response(JSON.stringify({ ok: true, event: eventType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
