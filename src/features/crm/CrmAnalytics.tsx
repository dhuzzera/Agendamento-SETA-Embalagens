import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Clock, Target, DollarSign } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CrmAnalytics() {
  const { data: analytics } = useQuery({
    queryKey: ["crm-analytics"],
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: deals }, { data: stages }, { data: pipelines }] = await Promise.all([
        supabase.from("deals").select("id, title, stage_id, pipeline_id, value, created_at, updated_at, lost_reason"),
        supabase.from("deal_stages").select("id, name, position, pipeline_id, color"),
        supabase.from("pipelines").select("id, name"),
      ]);

      if (!deals?.length || !stages?.length) return null;

      const stageMap = new Map((stages ?? []).map((s) => [s.id, s]));
      const pipelineMap = new Map((pipelines ?? []).map((p) => [p.id, p.name]));

      // Funil de conversão: quantos deals em cada estágio
      const funnelData = new Map<string, { name: string; count: number; value: number; color: string }>();
      for (const s of stages.sort((a, b) => a.position - b.position)) {
        const key = s.name;
        if (!funnelData.has(key)) {
          funnelData.set(key, { name: s.name, count: 0, value: 0, color: s.color });
        }
      }
      for (const d of deals) {
        const stage = stageMap.get(d.stage_id);
        if (stage) {
          const entry = funnelData.get(stage.name);
          if (entry) {
            entry.count++;
            entry.value += d.value ?? 0;
          }
        }
      }

      // Tempo médio por estágio (aproximado: diferença entre created_at e updated_at)
      const avgDays = deals.length > 0
        ? Math.round(deals.reduce((s, d) => s + differenceInDays(new Date(d.updated_at), new Date(d.created_at)), 0) / deals.length)
        : 0;

      // Taxa de conversão
      const wonStages = new Set(stages.filter((s) => ["Fechados", "Fechada", "Venda Fechada"].includes(s.name)).map((s) => s.id));
      const lostStages = new Set(stages.filter((s) => ["Perdidos", "Perdido", "Não Aprovada"].includes(s.name)).map((s) => s.id));
      const wonDeals = deals.filter((d) => wonStages.has(d.stage_id));
      const lostDeals = deals.filter((d) => lostStages.has(d.stage_id));
      const closedTotal = wonDeals.length + lostDeals.length;
      const conversionRate = closedTotal > 0 ? ((wonDeals.length / closedTotal) * 100).toFixed(1) : "0";

      // Valor total ganho
      const totalWonValue = wonDeals.reduce((s, d) => s + (d.value ?? 0), 0);

      // Motivos de perda
      const lossReasons = new Map<string, number>();
      for (const d of lostDeals) {
        const reason = d.lost_reason || "Não informado";
        lossReasons.set(reason, (lossReasons.get(reason) ?? 0) + 1);
      }
      const topLossReasons = [...lossReasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return {
        totalDeals: deals.length,
        funnel: [...funnelData.values()],
        avgDays,
        conversionRate,
        wonCount: wonDeals.length,
        lostCount: lostDeals.length,
        totalWonValue,
        topLossReasons,
      };
    },
  });

  if (!analytics) return <p className="p-8 text-center text-muted-foreground">Carregando análises…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Análises</h1>
        <p className="text-muted-foreground">Funil de conversão, métricas e insights do pipeline.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div><div className="text-lg font-bold">{analytics.totalDeals}</div><div className="text-xs text-muted-foreground">Total de deals</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Target className="h-5 w-5 text-green-500" />
          <div><div className="text-lg font-bold">{analytics.conversionRate}%</div><div className="text-xs text-muted-foreground">Taxa de conversão</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Clock className="h-5 w-5 text-blue-500" />
          <div><div className="text-lg font-bold">{analytics.avgDays} dias</div><div className="text-xs text-muted-foreground">Tempo médio</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <div><div className="text-lg font-bold">{analytics.wonCount}</div><div className="text-xs text-muted-foreground">Vendas ganhas</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <DollarSign className="h-5 w-5 text-green-500" />
          <div><div className="text-lg font-bold">R$ {analytics.totalWonValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div><div className="text-xs text-muted-foreground">Valor ganho</div></div>
        </CardContent></Card>
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.funnel.map((stage, i) => {
              const maxCount = Math.max(...analytics.funnel.map((s) => s.count), 1);
              const pct = (stage.count / maxCount) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-36 text-sm font-medium truncate">{stage.name}</div>
                  <div className="flex-1 h-8 rounded-md bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-md flex items-center px-3 text-xs font-bold text-white transition-all"
                      style={{ width: `${Math.max(pct, 5)}%`, backgroundColor: stage.color }}
                    >
                      {stage.count}
                    </div>
                  </div>
                  <div className="w-24 text-right text-xs text-muted-foreground">
                    R$ {stage.value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Loss reasons */}
      {analytics.topLossReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Principais motivos de perda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topLossReasons.map(([reason, count], i) => (
                <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{reason}</span>
                  <Badge variant="destructive" className="text-xs">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
