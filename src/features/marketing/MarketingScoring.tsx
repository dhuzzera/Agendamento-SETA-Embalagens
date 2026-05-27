import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Star, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

const EVENT_LABELS: Record<string, string> = {
  appointment_created: "Agendou reunião",
  appointment_completed: "Reunião realizada",
  email_opened: "Abriu e-mail",
  email_clicked: "Clicou no e-mail",
  deal_won: "Venda fechada",
  deal_lost: "Negociação perdida",
  task_completed: "Tarefa concluída",
  manual: "Manual",
};

export function MarketingScoring() {
  const { data: rules, isLoading, refetch } = useQuery({
    queryKey: ["marketing-scoring-rules"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("scoring_rules")
        .select("*")
        .order("event_type");
      return data ?? [];
    },
  });

  // Top scored leads
  const { data: topLeads } = useQuery({
    queryKey: ["marketing-top-leads"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, company, email, lead_score")
        .gt("lead_score", 0)
        .order("lead_score", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const updatePoints = async (id: string, points: number) => {
    await supabase.from("scoring_rules").update({ points }).eq("id", id);
    toast.success("Pontuação atualizada");
    void refetch();
  };

  const toggleRule = async (id: string, active: boolean) => {
    await supabase.from("scoring_rules").update({ active: !active }).eq("id", id);
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead Scoring</h1>
        <p className="text-muted-foreground">Configure a pontuação automática dos leads baseada em ações.</p>
      </div>

      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-yellow-500" />
            Regras de pontuação
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><ListRowSkeleton /><ListRowSkeleton /></div>
          ) : (
            <div className="divide-y">
              {(rules ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={r.active} onCheckedChange={() => void toggleRule(r.id, r.active)} />
                    <div>
                      <p className="text-sm font-medium">{EVENT_LABELS[r.event_type] ?? r.event_type}</p>
                      {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      defaultValue={r.points}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v !== r.points) void updatePoints(r.id, v);
                      }}
                      className="h-8 w-20 text-center text-sm"
                    />
                    <span className="text-xs text-muted-foreground">pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top leads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Top leads por pontuação
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!topLeads?.length ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum lead com pontuação ainda.</p>
          ) : (
            <div className="divide-y">
              {topLeads.map((l, i) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.company ?? l.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold">
                    {l.lead_score} pts
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
