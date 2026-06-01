import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Handshake, DollarSign, CheckSquare, AlertTriangle,
  TrendingUp, Clock, ArrowRight, Plus,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CrmDashboard() {
  const { profile, role } = useAuth();
  const [viewMode] = useViewMode();
  const isAdmin = role === "admin" && viewMode === "admin";

  const { data } = useQuery({
    queryKey: ["crm-dashboard", profile?.id, isAdmin],
    enabled: !!profile,
    staleTime: 60_000,
    queryFn: async () => {
      let dealsQ = supabase.from("deals").select("id, title, stage_id, value, updated_at, representative_id, client_id");
      if (!isAdmin) dealsQ = dealsQ.eq("representative_id", profile!.id);
      const { data: deals } = await dealsQ;

      const { data: stages } = await supabase.from("deal_stages").select("id, name, color, pipeline_id");
      const stageMap = new Map((stages ?? []).map((s) => [s.id, s]));

      // Overdue tasks
      let tasksQ = supabase
        .from("deal_activities")
        .select("id, type, subject, description, due_date, deal_id")
        .eq("completed", false)
        .not("due_date", "is", null)
        .lt("due_date", new Date().toISOString())
        .order("due_date")
        .limit(10);
      if (!isAdmin) tasksQ = tasksQ.eq("assigned_to", profile!.id);
      const { data: overdueTasks } = await tasksQ;

      // Enrich tasks with deal titles
      const dealIds = [...new Set((overdueTasks ?? []).map((t) => t.deal_id))];
      const { data: taskDeals } = dealIds.length
        ? await supabase.from("deals").select("id, title").in("id", dealIds)
        : { data: [] as { id: string; title: string }[] };
      const dealTitleMap = new Map((taskDeals ?? []).map((d) => [d.id, d.title]));

      // Pipeline value by stage
      const byStage = new Map<string, { name: string; color: string; count: number; value: number }>();
      for (const d of deals ?? []) {
        const stage = stageMap.get(d.stage_id);
        if (!stage) continue;
        const cur = byStage.get(d.stage_id) ?? { name: stage.name, color: stage.color, count: 0, value: 0 };
        cur.count++;
        cur.value += d.value ?? 0;
        byStage.set(d.stage_id, cur);
      }

      const wonStages = new Set((stages ?? []).filter((s) => ["Fechados", "Fechada", "Venda Fechada"].includes(s.name)).map((s) => s.id));
      const lostStages = new Set((stages ?? []).filter((s) => ["Perdidos", "Perdido", "Não Aprovada"].includes(s.name)).map((s) => s.id));
      const activeDeals = (deals ?? []).filter((d) => !wonStages.has(d.stage_id) && !lostStages.has(d.stage_id));
      const wonDeals = (deals ?? []).filter((d) => wonStages.has(d.stage_id));

      return {
        totalActive: activeDeals.length,
        pipelineValue: activeDeals.reduce((s, d) => s + (d.value ?? 0), 0),
        wonCount: wonDeals.length,
        wonValue: wonDeals.reduce((s, d) => s + (d.value ?? 0), 0),
        overdueCount: overdueTasks?.length ?? 0,
        overdueTasks: (overdueTasks ?? []).map((t) => ({
          ...t,
          deal_title: dealTitleMap.get(t.deal_id) ?? "—",
        })),
        byStage: [...byStage.values()].sort((a, b) => b.count - a.count),
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM — Início</h1>
          <p className="text-muted-foreground">Visão geral do pipeline comercial.</p>
        </div>
        <Link to="/crm/negociacoes">
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Nova negociação
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Handshake className="h-5 w-5 text-primary" />} label="Deals em aberto" value={data?.totalActive ?? 0} />
        <StatCard icon={<DollarSign className="h-5 w-5 text-blue-500" />} label="Valor pipeline" value={`R$ ${(data?.pipelineValue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-green-500" />} label="Vendas ganhas" value={data?.wonCount ?? 0} />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} label="Tarefas atrasadas" value={data?.overdueCount ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline por estágio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline por estágio</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.byStage.length ? (
              <p className="text-sm text-muted-foreground">Nenhum deal no pipeline.</p>
            ) : (
              <div className="space-y-2">
                {data.byStage.map((s, i) => {
                  const max = Math.max(...data.byStage.map((x) => x.count), 1);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-28 truncate text-xs font-medium">{s.name}</div>
                      <div className="flex-1 h-6 rounded bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded flex items-center px-2 text-[10px] font-bold text-white"
                          style={{ width: `${Math.max((s.count / max) * 100, 8)}%`, backgroundColor: s.color }}
                        >
                          {s.count}
                        </div>
                      </div>
                      <div className="w-20 text-right text-xs text-muted-foreground">
                        {s.value > 0 ? `R$ ${s.value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tarefas atrasadas */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-red-500" />
              Tarefas atrasadas
            </CardTitle>
            <Link to="/crm/tarefas" className="text-xs text-primary hover:underline">Ver todas →</Link>
          </CardHeader>
          <CardContent>
            {!data?.overdueTasks.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa atrasada. 🎉</p>
            ) : (
              <div className="space-y-2">
                {data.overdueTasks.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-start justify-between rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.subject || t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.deal_title}</p>
                    </div>
                    <div className="ml-2 shrink-0 text-right">
                      <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {format(parseISO(t.due_date!), "dd/MM HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
