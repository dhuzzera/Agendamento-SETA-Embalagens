/**
 * Gera um relatório PDF simples usando a API nativa do navegador (window.print).
 * Cria uma janela temporária com o conteúdo formatado e dispara a impressão,
 * que permite salvar como PDF sem dependências externas.
 */

import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PdfReportData {
  title: string;
  period: string;
  stats: { label: string; value: string | number }[];
  appointments: {
    date: string;
    time: string;
    client: string;
    representative: string;
    type: string;
    status: string;
  }[];
  topReps: { name: string; total: number }[];
}

export function generatePdfReport(data: PdfReportData) {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1f2937; font-size: 12px; }
    h1 { font-size: 20px; color: #1a3264; margin-bottom: 4px; }
    .period { color: #6b7280; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; min-width: 120px; }
    .stat-value { font-size: 20px; font-weight: 700; color: #1a3264; }
    .stat-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
    h2 { font-size: 14px; margin: 24px 0 8px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f9fafb; text-align: left; padding: 8px; font-size: 11px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 10px; }
    .ranking { display: flex; gap: 8px; flex-wrap: wrap; }
    .rank-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; }
    .rank-pos { font-weight: 700; color: #1a3264; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${data.title}</h1>
  <p class="period">${data.period}</p>

  <div class="stats">
    ${data.stats.map((s) => `<div class="stat"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join("")}
  </div>

  ${data.topReps.length > 0 ? `
  <h2>Representantes mais ativos</h2>
  <div class="ranking">
    ${data.topReps.map((r, i) => `<div class="rank-item"><span class="rank-pos">${i + 1}º</span> ${r.name} — ${r.total} agendamentos</div>`).join("")}
  </div>
  ` : ""}

  <h2>Agendamentos (${data.appointments.length})</h2>
  <table>
    <thead>
      <tr><th>Data</th><th>Horário</th><th>Cliente</th><th>Representante</th><th>Tipo</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${data.appointments.map((a) => `<tr><td>${a.date}</td><td>${a.time}</td><td>${a.client}</td><td>${a.representative}</td><td>${a.type}</td><td>${a.status}</td></tr>`).join("")}
    </tbody>
  </table>

  <div class="footer">
    <p>SETA Embalagens — Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
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
