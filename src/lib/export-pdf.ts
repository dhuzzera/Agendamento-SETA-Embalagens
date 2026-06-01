/**
 * Gera um relatório PDF completo usando a API nativa do navegador (window.print).
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PdfReportData {
  title: string;
  period: string;
  stats: { label: string; value: string | number }[];
  appointments: {
    date: string;
    time: string;
    client: string;
    company?: string;
    representative: string;
    type: string;
    status: string;
    city?: string;
    result?: string;
    value?: string;
    notes?: string;
  }[];
  topReps: { name: string; total: number; completed?: number; value?: number }[];
}

export function generatePdfReport(data: PdfReportData) {
  // Group by representative
  const byRep = new Map<string, typeof data.appointments>();
  for (const a of data.appointments) {
    const arr = byRep.get(a.representative) ?? [];
    arr.push(a);
    byRep.set(a.representative, arr);
  }

  // Stats by status
  const statusCount = data.appointments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Stats by type
  const presencial = data.appointments.filter((a) => a.type === "Presencial").length;
  const online = data.appointments.filter((a) => a.type === "Online").length;

  // Results
  const vendas = data.appointments.filter((a) => a.result === "Venda fechada").length;
  const negociacao = data.appointments.filter((a) => a.result === "Em negociação").length;
  const reprovadas = data.appointments.filter((a) => a.result === "Reprovada").length;

  const statusColor: Record<string, string> = {
    "Agendado": "#2563eb",
    "Concluído": "#16a34a",
    "Cancelado": "#dc2626",
    "Remarcado": "#d97706",
  };

  const resultColor: Record<string, string> = {
    "Venda fechada": "#16a34a",
    "Em negociação": "#2563eb",
    "Reprovada": "#dc2626",
  };

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #1f2937; font-size: 11px; }

    /* Header */
    .header { background: #1a3264; color: #fff; padding: 20px 24px; border-radius: 8px; margin-bottom: 24px; }
    .header h1 { font-size: 18px; margin-bottom: 4px; }
    .header p { color: #93c5fd; font-size: 12px; }

    /* Stats grid */
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 24px; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
    .stat-value { font-size: 18px; font-weight: 700; color: #1a3264; }
    .stat-label { font-size: 10px; color: #6b7280; margin-top: 2px; }

    /* Section */
    h2 { font-size: 13px; font-weight: 700; color: #1a3264; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1a3264; }
    h3 { font-size: 12px; font-weight: 600; color: #374151; margin: 14px 0 6px; background: #f3f4f6; padding: 6px 10px; border-radius: 4px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #1a3264; color: #fff; text-align: left; padding: 7px 8px; font-size: 10px; font-weight: 600; }
    td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; font-size: 10px; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }

    /* Badges */
    .badge { display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 9px; font-weight: 600; }

    /* Ranking */
    .ranking { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .rank-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; min-width: 160px; }
    .rank-pos { font-size: 16px; font-weight: 700; color: #1a3264; }
    .rank-name { font-weight: 600; margin: 2px 0; }
    .rank-detail { color: #6b7280; font-size: 10px; }

    /* Footer */
    .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 12px; }

    @media print {
      body { padding: 16px; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h3 { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>${data.title}</h1>
    <p>Período: ${data.period} &nbsp;|&nbsp; Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
  </div>

  <!-- Resumo geral -->
  <h2>Resumo geral</h2>
  <div class="stats">
    ${data.stats.map((s) => `<div class="stat"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join("")}
    <div class="stat"><div class="stat-value">${presencial}</div><div class="stat-label">Presenciais</div></div>
    <div class="stat"><div class="stat-value">${online}</div><div class="stat-label">Online</div></div>
    ${vendas > 0 ? `<div class="stat"><div class="stat-value" style="color:#16a34a;">${vendas}</div><div class="stat-label">Vendas fechadas</div></div>` : ""}
    ${negociacao > 0 ? `<div class="stat"><div class="stat-value" style="color:#2563eb;">${negociacao}</div><div class="stat-label">Em negociação</div></div>` : ""}
  </div>

  <!-- Ranking de representantes -->
  ${data.topReps.length > 0 ? `
  <h2>Representantes</h2>
  <div class="ranking">
    ${data.topReps.map((r, i) => `
    <div class="rank-item">
      <div class="rank-pos">${i + 1}º</div>
      <div class="rank-name">${r.name}</div>
      <div class="rank-detail">${r.total} agendamentos${r.completed != null ? ` · ${r.completed} concluídos` : ""}${r.value ? ` · R$ ${r.value.toLocaleString("pt-BR")}` : ""}</div>
    </div>`).join("")}
  </div>
  ` : ""}

  <!-- Por representante -->
  ${[...byRep.entries()].map(([rep, appts]) => `
  <h3>📋 ${rep} — ${appts.length} agendamento(s)</h3>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Horário</th>
        <th>Cliente</th>
        <th>Empresa</th>
        <th>Tipo</th>
        <th>Cidade</th>
        <th>Status</th>
        <th>Resultado</th>
        <th>Valor</th>
      </tr>
    </thead>
    <tbody>
      ${appts.map((a) => `
      <tr>
        <td>${a.date}</td>
        <td>${a.time}</td>
        <td>${a.client}</td>
        <td>${a.company || "—"}</td>
        <td>${a.type}</td>
        <td>${a.city || "—"}</td>
        <td><span class="badge" style="background:${(statusColor[a.status] || "#6b7280") + "22"};color:${statusColor[a.status] || "#6b7280"};">${a.status}</span></td>
        <td>${a.result ? `<span class="badge" style="background:${(resultColor[a.result] || "#6b7280") + "22"};color:${resultColor[a.result] || "#6b7280"};">${a.result}</span>` : "—"}</td>
        <td>${a.value ? `R$ ${a.value}` : "—"}</td>
      </tr>
      ${a.notes ? `<tr><td colspan="9" style="color:#6b7280;font-style:italic;padding:2px 8px 6px;">Obs: ${a.notes}</td></tr>` : ""}`).join("")}
    </tbody>
  </table>
  `).join("")}

  <div class="footer">
    <p>SETA Embalagens — Relatório gerado automaticamente pelo sistema de agendamento comercial.</p>
  </div>

</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Permita pop-ups para gerar o PDF.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}
