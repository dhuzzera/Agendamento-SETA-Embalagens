import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingPayload {
  clientName: string;
  clientEmail: string;
  representativeName: string;
  date: string;        // "2026-05-20"
  startTime: string;   // "09:00:00"
  endTime: string;     // "10:00:00"
  meetingType: "online" | "presencial";
  location?: string;
  city?: string;
  state?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: BookingPayload = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@setaembalagens.com.br";

    // Formata data em português
    const [year, month, day] = payload.date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const dateFormatted = `${weekdays[dateObj.getDay()]}, ${day} de ${months[month - 1]} de ${year}`;

    const startFormatted = payload.startTime.slice(0, 5);
    const endFormatted = payload.endTime.slice(0, 5);
    const isPresencial = payload.meetingType === "presencial";
    const modalidade = isPresencial ? "Presencial" : "Online";

    const locationLine = isPresencial && payload.location
      ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Local</td><td style="padding:8px 0;font-size:14px;font-weight:500;">${payload.location}</td></tr>`
      : "";

    const cityLine = isPresencial && payload.city
      ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Cidade</td><td style="padding:8px 0;font-size:14px;font-weight:500;">${payload.city}${payload.state ? ` - ${payload.state}` : ""}</td></tr>`
      : "";

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Agendamento</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a3264 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.8);">Agendamento confirmado</p>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Tudo certo, ${payload.clientName.split(" ")[0]}!</h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Sua reunião com a SETA Embalagens está confirmada.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 20px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6b7280;">Resumo do agendamento</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f9fafb;">
                  <td style="padding:8px 16px;color:#6b7280;font-size:14px;">Representante</td>
                  <td style="padding:8px 16px;font-size:14px;font-weight:500;">${payload.representativeName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Data</td>
                  <td style="padding:8px 16px;font-size:14px;font-weight:500;border-top:1px solid #e5e7eb;text-transform:capitalize;">${dateFormatted}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:8px 16px;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Horário</td>
                  <td style="padding:8px 16px;font-size:14px;font-weight:500;border-top:1px solid #e5e7eb;">${startFormatted} – ${endFormatted}</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Modalidade</td>
                  <td style="padding:8px 16px;font-size:14px;font-weight:500;border-top:1px solid #e5e7eb;">${modalidade}</td>
                </tr>
                ${cityLine ? `<tr style="background:#f9fafb;">${cityLine.replace(/<tr[^>]*>|<\/tr>/g, "")}</tr>` : ""}
                ${locationLine ? `<tr>${locationLine.replace(/<tr[^>]*>|<\/tr>/g, "")}</tr>` : ""}
              </table>

              <!-- Info box -->
              <div style="margin-top:24px;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
                <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1d4ed8;">O que acontece agora?</p>
                <ul style="margin:0;padding-left:16px;color:#4b5563;font-size:14px;line-height:1.6;">
                  <li>Adicione o compromisso à sua agenda.</li>
                  <li>Em caso de imprevisto, responda este e-mail para reagendar.</li>
                  ${isPresencial ? "<li>Confirme o endereço da reunião com antecedência.</li>" : "<li>O link da reunião online será enviado pelo representante.</li>"}
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                SETA Embalagens · <a href="https://setaembalagens.com.br" style="color:#2563eb;text-decoration:none;">setaembalagens.com.br</a>
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">Este e-mail foi enviado automaticamente. Não responda diretamente.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `SETA Embalagens <${FROM_EMAIL}>`,
        to: [payload.clientEmail],
        subject: `Reunião confirmada — ${dateFormatted} às ${startFormatted}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
