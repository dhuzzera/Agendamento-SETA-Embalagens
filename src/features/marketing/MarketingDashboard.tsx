import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Users, Star, Zap, TrendingUp, Send, Eye } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MarketingDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["marketing-dashboard-stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: campaigns }, { data: lists }, { data: automations }, { data: topLeads }] = await Promise.all([
        supabase.from("campaigns").select("id, status, total_sent, total_opened, total_recipients"),
        supabase.from("contact_list_members").select("list_id"),
        supabase.from("automations").select("id, active"),
        supabase.from("clients").select("id, name, company, lead_score").gt("lead_score", 0).order("lead_score", { ascending: false }).limit(10),
      ]);

      const totalCampaigns = campaigns?.length ?? 0;
      const sentCampaigns = campaigns?.filter((c) => c.status === "sent") ?? [];
      const totalSent = sentCampaigns.reduce((s, c) => s + (c.total_sent ?? 0), 0);
      const totalOpened = sentCampaigns.reduce((s, c) => s + (c.total_opened ?? 0), 0);
      const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
      const totalContacts = new Set((lists ?? []).map((m) => m.list_id)).size;
      const activeAutomations = automations?.filter((a) => a.active).length ?? 0;

      return {
        totalCampaigns,
        sentCampaigns: sentCampaigns.length,
        totalSent,
        totalOpened,
        openRate,
        totalLists: totalContacts,
        activeAutomations,
        topLeads: topLeads ?? [],
      };
    },
  });

  // Recent campaigns
  const { data: recentCampaigns } = useQuery({
    queryKey: ["marketing-recent-campaigns"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, status, total_sent, total_opened, sent_at, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing — Visão geral</h1>
        <p className="text-muted-foreground">Métricas de campanhas, leads e automações.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Send className="h-5 w-5 text-primary" />} label="Campanhas enviadas" value={stats?.sentCampaigns ?? 0} />
        <StatCard icon={<Mail className="h-5 w-5 text-blue-500" />} label="E-mails enviados" value={stats?.totalSent ?? 0} />
        <StatCard icon={<Eye className="h-5 w-5 text-green-500" />} label="Taxa de abertura" value={`${stats?.openRate ?? 0}%`} />
        <StatCard icon={<Zap className="h-5 w-5 text-yellow-500" />} label="Automações ativas" value={stats?.activeAutomations ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campanhas recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!recentCampaigns?.length ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma campanha.</p>
            ) : (
              <div className="divide-y">
                {recentCampaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.sent_at ? `Enviada ${format(new Date(c.sent_at), "dd/MM", { locale: ptBR })}` : c.status === "draft" ? "Rascunho" : c.status}
                      </p>
                    </div>
                    {c.status === "sent" && (
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{c.total_sent} enviados</div>
                        <div>{c.total_opened} abertos</div>
                      </div>
                    )}
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
              <Star className="h-4 w-4 text-yellow-500" />
              Top leads por score
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!stats?.topLeads.length ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum lead com pontuação.</p>
            ) : (
              <div className="divide-y">
                {stats.topLeads.map((l, i) => (
                  <div key={l.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{l.name}</p>
                        {l.company && <p className="text-[10px] text-muted-foreground">{l.company}</p>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{l.lead_score} pts</Badge>
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
