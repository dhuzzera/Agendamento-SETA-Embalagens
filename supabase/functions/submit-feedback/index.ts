import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const rating = parseInt(url.searchParams.get("rating") || "0", 10);

    if (!token || rating < 1 || rating > 5) {
      return new Response("<h1>Link invalido</h1>", { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Salva o feedback no appointment
    const { error } = await supabase
      .from("appointments")
      .update({ feedback_rating: rating })
      .eq("id", token);

    if (error) {
      return new Response("<h1>Erro ao salvar</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const stars = "⭐".repeat(rating);
    const messages: Record<number, string> = {
      5: "Que otimo! Ficamos felizes que a experiencia foi excelente.",
      4: "Muito bom! Obrigado pelo feedback positivo.",
      3: "Obrigado! Vamos trabalhar para melhorar.",
      2: "Sentimos muito. Vamos melhorar na proxima.",
      1: "Lamentamos a experiencia. Entraremos em contato.",
    };

    const html = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head><body style='font-family:-apple-system,sans-serif;max-width:500px;margin:60px auto;text-align:center;padding:20px;'><div style='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:32px;'><p style='font-size:48px;margin:0;'>" + stars + "</p><h1 style='color:#16a34a;font-size:24px;margin-top:16px;'>Obrigado pelo feedback!</h1><p style='color:#4b5563;margin-top:12px;'>" + (messages[rating] || "Obrigado!") + "</p></div><p style='margin-top:24px;color:#9ca3af;font-size:12px;'>SETA Embalagens</p></body></html>";

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return new Response("<h1>Erro interno</h1>", { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
