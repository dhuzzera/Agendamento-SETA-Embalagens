import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  DollarSign,
  User,
  Calendar,
  GripVertical,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ImportLeadsDialog } from "./ImportLeadsDialog";

type Stage = { id: string; name: string; position: number; color: string };
type Deal = {
  id: string;
  title: string;
  client_id: string | null;
  representative_id: string;
  stage_id: string;
  value: number | null;
  expected_close_date: string | null;
  notes: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_company?: string | null;
  client_email?: string;
  rep_name?: string;
  next_activity?: { type: string; due_date: string; subject: string | null } | null;
};

type Activity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
  completed: boolean;
  due_date: string | null;
};

export function CrmKanban() {
  const { profile, role } = useAuth();
  const [viewMode] = useViewMode();
  const isAdmin = role === "admin" && viewMode === "admin";
  const queryClient = useQueryClient();

  const [newDealOpen, setNewDealOpen] = useState(false);
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [repFilter, setRepFilter] = useState("__all__");
  const [dealStatusFilter, setDealStatusFilter] = useState("__all__");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");

  // Load pipelines
  const { data: pipelines } = useQuery({
    queryKey: ["crm-pipelines", profile?.id, isAdmin],
    enabled: !!profile,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from("pipelines")
        .select("id, name, position, owner_id")
        .order("position");

      // Representante só vê o funil dele
      if (!isAdmin) {
        q = q.eq("owner_id", profile!.id);
      }

      const { data } = await q;
      return (data ?? []) as { id: string; name: string; position: number; owner_id: string | null }[];
    },
  });

  // Auto-select first pipeline (or the only one for reps)
  useEffect(() => {
    if (pipelines?.length && !selectedPipeline) {
      setSelectedPipeline(pipelines[0].id);
    }
  }, [pipelines, selectedPipeline]);

  // Load reps for filter
  const { data: reps } = useQuery({
    queryKey: ["crm-reps"],
    enabled: isAdmin,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  // Load stages for selected pipeline
  const { data: stages } = useQuery({
    queryKey: ["crm-stages", selectedPipeline],
    enabled: !!selectedPipeline,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_stages")
        .select("*")
        .eq("pipeline_id", selectedPipeline)
        .order("position");
      return (data ?? []) as Stage[];
    },
  });

  // Load deals
  const { data: deals, refetch: refetchDeals } = useQuery({
    queryKey: ["crm-deals", profile?.id, isAdmin, repFilter, selectedPipeline],
    enabled: !!profile && !!selectedPipeline,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("deals")
        .select("*")
        .eq("pipeline_id", selectedPipeline)
        .order("updated_at", { ascending: false });

      if (!isAdmin) q = q.eq("representative_id", profile!.id);
      else if (repFilter !== "__all__") q = q.eq("representative_id", repFilter);

      const { data } = await q;
      if (!data?.length) return [];

      // Enrich with client and rep names
      const clientIds = [...new Set(data.map((d) => d.client_id).filter(Boolean))] as string[];
      const repIds = [...new Set(data.map((d) => d.representative_id))];
      const dealIds = data.map((d) => d.id);

      const [{ data: clients }, { data: repsData }, { data: nextActivities }] = await Promise.all([
        clientIds.length
          ? supabase.from("clients").select("id, name, company, email").in("id", clientIds)
          : { data: [] as { id: string; name: string; company: string | null; email: string }[] },
        supabase.from("profiles").select("id, full_name").in("id", repIds),
        // Fetch next pending activity for each deal
        supabase
          .from("deal_activities")
          .select("deal_id, type, due_date, subject")
          .in("deal_id", dealIds)
          .eq("completed", false)
          .not("due_date", "is", null)
          .order("due_date", { ascending: true }),
      ]);

      const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
      const repMap = new Map((repsData ?? []).map((r) => [r.id, r.full_name]));

      // Group next activity per deal (first one = soonest)
      const nextActivityMap = new Map<string, { type: string; due_date: string; subject: string | null }>();
      for (const act of nextActivities ?? []) {
        if (!nextActivityMap.has(act.deal_id)) {
          nextActivityMap.set(act.deal_id, { type: act.type, due_date: act.due_date!, subject: act.subject });
        }
      }

      return data.map((d) => ({
        ...d,
        client_name: d.client_id ? clientMap.get(d.client_id)?.name : undefined,
        client_company: d.client_id ? clientMap.get(d.client_id)?.company : undefined,
        client_email: d.client_id ? clientMap.get(d.client_id)?.email : undefined,
        rep_name: repMap.get(d.representative_id) ?? "—",
        next_activity: nextActivityMap.get(d.id) ?? null,
      })) as Deal[];
    },
  });

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of stages ?? []) {
      map.set(stage.id, []);
    }
    for (const deal of deals ?? []) {
      const arr = map.get(deal.stage_id);
      if (arr) arr.push(deal);
    }
    return map;
  }, [stages, deals]);

  const moveDeal = async (dealId: string, newStageId: string) => {
    const { error } = await supabase
      .from("deals")
      .update({ stage_id: newStageId })
      .eq("id", dealId);

    if (error) { toast.error(error.message); return; }

    // Log activity
    await supabase.from("deal_activities").insert({
      deal_id: dealId,
      user_id: profile?.id,
      type: "stage_change",
      description: `Movido para ${stages?.find((s) => s.id === newStageId)?.name ?? "novo estágio"}`,
    });

    void refetchDeals();
  };

  // Stats
  const stats = useMemo(() => {
    if (!deals) return { total: 0, value: 0, won: 0, wonValue: 0 };
    const wonStage = stages?.find((s) => s.name === "Venda fechada");
    const won = deals.filter((d) => d.stage_id === wonStage?.id);
    const active = deals.filter((d) => d.stage_id !== wonStage?.id && d.stage_id !== stages?.find((s) => s.name === "Perdido")?.id);
    return {
      total: active.length,
      value: active.reduce((s, d) => s + (d.value ?? 0), 0),
      won: won.length,
      wonValue: won.reduce((s, d) => s + (d.value ?? 0), 0),
    };
  }, [deals, stages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="text-muted-foreground">Pipeline de oportunidades comerciais.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setNewDealOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova oportunidade
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniStat icon={<User className="h-4 w-4 text-primary" />} label="Em aberto" value={stats.total} />
        <MiniStat icon={<DollarSign className="h-4 w-4 text-blue-500" />} label="Valor pipeline" value={`R$ ${stats.value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} />
        <MiniStat icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label="Vendas ganhas" value={stats.won} />
        <MiniStat icon={<DollarSign className="h-4 w-4 text-green-500" />} label="Valor ganho" value={`R$ ${stats.wonValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {isAdmin && (
          <div>
            <Label className="text-xs">Funil</Label>
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecionar funil" />
              </SelectTrigger>
              <SelectContent>
                {(pipelines ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {isAdmin && (
          <div>
            <Label className="text-xs">Responsável</Label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(reps ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          {deals?.length ?? 0} negociações
        </div>
      </div>

      {/* Kanban */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: `${(stages?.length ?? 6) * 280}px` }}>
          {(stages ?? []).map((stage) => {
            const stageDeals = dealsByStage.get(stage.id) ?? [];
            const stageValue = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0);
            return (
              <div
                key={stage.id}
                className="w-[270px] shrink-0 rounded-xl border bg-muted/30 p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const dealId = e.dataTransfer.getData("dealId");
                  if (dealId) void moveDeal(dealId, stage.id);
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <h3 className="text-sm font-semibold">{stage.name}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    R$ {stageValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="space-y-2">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("dealId", deal.id)}
                      onClick={() => setDetailDeal(deal)}
                      className="cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{deal.title}</p>
                          {deal.client_name && (
                            <p className="truncate text-xs text-muted-foreground">
                              {deal.client_name}
                              {deal.client_company && ` • ${deal.client_company}`}
                            </p>
                          )}
                        </div>
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                      </div>
                      {deal.value != null && deal.value > 0 && (
                        <p className="mt-2 text-xs font-semibold text-green-600 dark:text-green-400">
                          R$ {Number(deal.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      {/* Next activity */}
                      {deal.next_activity && (
                        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary">
                          <span>📋</span>
                          <span className="uppercase">{deal.next_activity.type === "call" ? "Ligação" : deal.next_activity.type === "visit" ? "Visita" : deal.next_activity.type === "whatsapp" ? "Whats" : deal.next_activity.type === "meeting" ? "Reunião" : deal.next_activity.type === "email" ? "E-mail" : "Tarefa"}</span>
                          <span>{format(new Date(deal.next_activity.due_date), "dd/MM HH:mm")}</span>
                        </div>
                      )}
                      {!deal.next_activity && (
                        <p className="mt-2 text-[10px] text-muted-foreground/60">Sem tarefas</p>
                      )}
                      {isAdmin && deal.rep_name && (
                        <p className="mt-1 text-[10px] text-muted-foreground">{deal.rep_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* New Deal Dialog */}
      {newDealOpen && (
        <NewDealDialog
          stages={stages ?? []}
          pipelineId={selectedPipeline}
          onClose={() => { setNewDealOpen(false); void refetchDeals(); }}
        />
      )}

      {/* Import Leads Dialog */}
      <ImportLeadsDialog
        open={importOpen}
        onClose={() => { setImportOpen(false); void refetchDeals(); }}
        stages={stages ?? []}
      />

      {/* Deal Detail Dialog */}
      {detailDeal && (
        <DealDetailDialog
          deal={detailDeal}
          stages={stages ?? []}
          onClose={() => { setDetailDeal(null); void refetchDeals(); }}
        />
      )}
    </div>
  );
}

function NewDealDialog({ stages, pipelineId, onClose }: { stages: Stage[]; pipelineId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error("Informe o título da oportunidade"); return; }
    if (!profile) return;
    setBusy(true);

    try {
      // Find or create client
      let clientId: string | null = null;
      if (clientEmail.trim()) {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("email", clientEmail.trim())
          .maybeSingle();

        if (existing) {
          clientId = existing.id;
        } else if (clientName.trim()) {
          const { data: newClient } = await supabase
            .from("clients")
            .insert({
              name: clientName.trim(),
              email: clientEmail.trim(),
              company: clientCompany.trim() || null,
            })
            .select("id")
            .single();
          clientId = newClient?.id ?? null;
        }
      }

      const { error } = await supabase.from("deals").insert({
        title: title.trim(),
        client_id: clientId,
        representative_id: profile.id,
        stage_id: stageId,
        pipeline_id: pipelineId || null,
        value: value ? parseFloat(value.replace(/[^\d.,]/g, "").replace(",", ".")) : null,
        notes: notes.trim() || null,
      });

      if (error) throw error;
      toast.success("Oportunidade criada!");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova oportunidade</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Caixas personalizadas - Empresa X" />
          </div>
          <div>
            <Label className="text-xs">Estágio</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor estimado (R$)</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="10.000,00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome do cliente</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="João Silva" />
            </div>
            <div>
              <Label className="text-xs">E-mail do cliente</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="joao@empresa.com" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Empresa</Label>
            <Input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="Empresa X" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Detalhes da oportunidade…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Criando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealDetailDialog({ deal, stages, onClose }: { deal: Deal; stages: Stage[]; onClose: () => void }) {
  const { profile } = useAuth();
  const [stageId, setStageId] = useState(deal.stage_id);
  const [value, setValue] = useState(deal.value?.toString() ?? "");
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [lostReason, setLostReason] = useState(deal.lost_reason ?? "");
  const [saving, setSaving] = useState(false);

  // Activities
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivity, setNewActivity] = useState("");
  const [activityType, setActivityType] = useState("note");

  useEffect(() => {
    void supabase
      .from("deal_activities")
      .select("id, type, description, created_at, completed, due_date")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setActivities((data ?? []) as Activity[]));
  }, [deal.id]);

  const save = async () => {
    setSaving(true);
    const parsedValue = value ? parseFloat(value.replace(/[^\d.,]/g, "").replace(",", ".")) : null;

    const { error } = await supabase
      .from("deals")
      .update({
        stage_id: stageId,
        value: parsedValue,
        notes: notes.trim() || null,
        lost_reason: lostReason.trim() || null,
      })
      .eq("id", deal.id);

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Log stage change if changed
    if (stageId !== deal.stage_id) {
      await supabase.from("deal_activities").insert({
        deal_id: deal.id,
        user_id: profile?.id,
        type: "stage_change",
        description: `Movido para ${stages.find((s) => s.id === stageId)?.name ?? ""}`,
      });
    }

    toast.success("Oportunidade atualizada!");
    setSaving(false);
    onClose();
  };

  const addActivity = async () => {
    if (!newActivity.trim()) return;
    await supabase.from("deal_activities").insert({
      deal_id: deal.id,
      user_id: profile?.id,
      type: activityType,
      description: newActivity.trim(),
    });
    setNewActivity("");
    // Reload
    const { data } = await supabase
      .from("deal_activities")
      .select("id, type, description, created_at, completed, due_date")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setActivities((data ?? []) as Activity[]);
    toast.success("Atividade registrada");
  };

  const currentStage = stages.find((s) => s.id === stageId);
  const isLost = currentStage?.name === "Perdido";

  const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
    note: <MessageSquare className="h-3.5 w-3.5" />,
    call: <Phone className="h-3.5 w-3.5" />,
    email: <Mail className="h-3.5 w-3.5" />,
    meeting: <Calendar className="h-3.5 w-3.5" />,
    stage_change: <ArrowRight className="h-3.5 w-3.5" />,
    task: <CheckCircle2 className="h-3.5 w-3.5" />,
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client info */}
          {deal.client_name && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{deal.client_name}</div>
              {deal.client_company && <div className="text-muted-foreground">{deal.client_company}</div>}
              {deal.client_email && <div className="text-xs text-muted-foreground">{deal.client_email}</div>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Estágio</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="10.000,00" />
            </div>
          </div>

          {isLost && (
            <div>
              <Label className="text-xs">Motivo da perda</Label>
              <Textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} rows={2} placeholder="Por que perdeu?" />
            </div>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Add activity */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Registrar atividade
            </p>
            <div className="flex gap-2">
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Nota</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="task">Tarefa</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                placeholder="Descreva…"
                onKeyDown={(e) => { if (e.key === "Enter") void addActivity(); }}
                className="flex-1"
              />
              <Button size="sm" onClick={addActivity} disabled={!newActivity.trim()}>
                +
              </Button>
            </div>
          </div>

          {/* Timeline */}
          {activities.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <div className="mt-0.5 text-muted-foreground">
                      {ACTIVITY_ICONS[a.type] ?? <MessageSquare className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground">{a.description}</p>
                      <p className="text-muted-foreground">
                        {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">{icon}</div>
        <div>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
