import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingUp, XCircle, RefreshCw } from "lucide-react";

export function SalesDashboard() {
  const { data } = useQuery({
    queryKey: ["admin-dashboard", "sales"],
    staleTime: 60_000,
    queryFn: async () => {
      const mStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const mEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data: appts } = await supabase
        .from("appointments")
        .select("meeting_result, sale_value, representative_id")
        .eq("status", "completed")
        .gte("appointment_date", mStart)
        .lte("appointment_date", mEnd)
        .not("meeting_result", "is", null);

      if (!appts?.length) return { vendas: 0, negociacao: 0, reprovadas: 0, valorTotal: 0, totalConcluidas: 0 };

      const vendas = appts.filter((a) => a.meeting_result === "venda_fechada").length;
      const negociacao = appts.filter((a) => a.meeting_result === "em_negociacao").length;
      const reprovadas = appts.filter((a) => a.meeting_result === "proposta_reprovada").length;

      const valorTotal = appts
        .filter((a) => a.meeting_result === "venda_fechada" && a.sale_value)
        .reduce((sum, a) => {
          const val = parseFloat((a.sale_value ?? "0").replace(/[^\d.,]/g, "").replace(",", "."));
          return sum + (isNaN(val) ? 0 : val);
        }, 0);

      return { vendas, negociacao, reprovadas, valorTotal, totalConcluidas: appts.length };
    },
  });

  if (!data || data.totalConcluidas === 0) return null;

  const taxaConversao = data.totalConcluidas > 0
    ? ((data.vendas / data.totalConcluidas) * 100).toFixed(0)
    : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4 text-primary" />
          Resultados comerciais — {format(new Date(), "MMMM yyyy", { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-900/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">Vendas fechadas</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-green-700 dark:text-green-400">{data.vendas}</div>
            {data.valorTotal > 0 && (
              <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                R$ {data.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-900/20">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Em negociação</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-400">{data.negociacao}</div>
          </div>

          <div className="rounded-lg border bg-red-50 p-4 dark:bg-red-900/20">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800 dark:text-red-300">Reprovadas</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-red-700 dark:text-red-400">{data.reprovadas}</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Taxa de conversão</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-primary">{taxaConversao}%</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.vendas} de {data.totalConcluidas} reuniões
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
