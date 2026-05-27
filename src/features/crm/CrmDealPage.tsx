import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Plus,
  XCircle,
  Trophy,
  Clock,
  MapPin,
  Users,
  Coffee,
  MessageCircle,
  Calendar,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Stage = { id: string; name: string; position: number; color: string };
type Activity = {
  id: string;
  type: string;
  subject: string | null;
  description: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
};

const TASK_TYPES = [
  { value: "call", label: "Ligação", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "visit", label: "Visita", icon: MapPin },
  { value: "meeting", label: "Reunião", icon: Users },
  { value: "task", label: "Tarefa", icon: CheckCircle2 },
  { value: "lunch", label: "Almoço", icon: Coffee },
  { value: "whatsapp", label: "Whatsapp", icon: MessageCircle },
];

export function CrmDealPage() {
  const { id } = useParams({ from: "/_app/crm/deal/$id" });
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);

  // Load reps for assignment
  const { data: allReps } = useQuery({
    queryKey: ["crm-all-reps"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  const changeResponsible = async (newRepId: string) => {
    const { error } = await supabase.from("deals").update({ representative_id: newRepId }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    const repName = allReps?.find((r) => r.id === newRepId)?.full_name ?? "";
    await supabase.from("deal_activities").insert({
      deal_id: id,
      user_id: profile?.id,
      type: "stage_change",
      description: `Responsável alterado para ${repName}`,
    });
    toast.success("Responsável atualizado");
    void refetch();
    void refetchActivities();
  };

  // Load deal
  const { data: deal, refetch } = useQuery({
    queryKey: ["crm-deal", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("*")
        .eq("id", id)
        .single();
      if (!data) return null;

      // Enrich
      const [{ data: client }, { data: pipeline }, { data: rep }] = await Promise.all([
        data.client_id ? supabase.from("clients").select("*").eq("id", data.client_id).maybeSingle() : { data: null },
        data.pipeline_id ? supabase.from("pipelines").select("name").eq("id", data.pipeline_id).maybeSingle() : { data: null },
        supabase.from("profiles").select("full_name").eq("id", data.representative_id).maybeSingle(),
      ]);

      // Company
      let company = null;
      if (data.company_id) {
        const { data: co } = await supabase.from("companies").select("*").eq("id", data.company_id).maybeSingle();
        company = co;
      }

      return {
        ...data,
        client,
        company,
        pipeline_name: pipeline?.name ?? null,
        rep_name: rep?.full_name ?? "—",
      };
    },
  });

  // Load stages for this pipeline
  const { data: stages } = useQuery({
    queryKey: ["crm-deal-stages", deal?.pipeline_id],
    enabled: !!deal?.pipeline_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_stages")
        .select("id, name, position, color")
        .eq("pipeline_id", deal!.pipeline_id)
        .order("position");
      return (data ?? []) as Stage[];
    },
  });

  // Load activities
  const { data: activities, refetch: refetchActivities } = useQuery({
    queryKey: ["crm-deal-activities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_activities")
        .select("id, type, subject, description, due_date, completed, created_at")
        .eq("deal_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Activity[];
    },
  });

  const pendingTasks = (activities ?? []).filter(
    (a) => !a.completed && a.due_date && ["call", "email", "visit", "meeting", "task", "lunch", "whatsapp"].includes(a.type),
  );

  const moveToStage = async (stageId: string) => {
    await supabase.from("deals").update({ stage_id: stageId }).eq("id", id);
    await supabase.from("deal_activities").insert({
      deal_id: id,
      user_id: profile?.id,
      type: "stage_change",
      description: `Movido para ${stages?.find((s) => s.id === stageId)?.name ?? ""}`,
    });
    void refetch();
    void refetchActivities();
  };

  const markWon = async () => {
    const wonStage = stages?.find((s) => s.name === "Fechados" || s.name === "Fechada" || s.name === "Venda Fechada");
    // Ask for value if not set
    if (!deal.value) {
      const valueStr = prompt("Valor da venda (R$):");
      if (valueStr === null) return;
      const parsed = parseFloat(valueStr.replace(/[^\d.,]/g, "").replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) {
        await supabase.from("deals").update({ value: parsed }).eq("id", id);
      }
    }
    if (wonStage) await moveToStage(wonStage.id);
    toast.success("Negociação marcada como venda!");
  };

  const markLost = async () => {
    const reason = prompt("Motivo da perda:");
    if (reason === null) return;
    const lostStage = stages?.find((s) => s.name === "Perdidos" || s.name === "Perdido" || s.name === "Não Aprovada");
    if (lostStage) {
      await supabase.from("deals").update({ stage_id: lostStage.id, lost_reason: reason || null }).eq("id", id);
      await supabase.from("deal_activities").insert({
        deal_id: id,
        user_id: profile?.id,
        type: "stage_change",
        description: `Marcado como perdido${reason ? `: ${reason}` : ""}`,
      });
      void refetch();
      void refetchActivities();
    }
    toast.success("Negociação marcada como perdida");
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    await supabase.from("deal_activities").insert({
      deal_id: id,
      user_id: profile?.id,
      type: "note",
      description: noteText.trim(),
    });
    setNoteText("");
    void refetchActivities();
    toast.success("Anotação adicionada");
  };

  const completeTask = async (taskId: string) => {
    await supabase.from("deal_activities").update({ completed: true }).eq("id", taskId);
    void refetchActivities();
    toast.success("Tarefa concluída");
  };

  if (!deal) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;

  const currentStage = stages?.find((s) => s.id === deal.stage_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate({ to: "/crm" })}
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            {deal.pipeline_name && (
              <Badge variant="secondary" className="mt-1">{deal.pipeline_name}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <ArrowRight className="mr-1.5 h-4 w-4" />
              Transferir
            </Button>
            <Button variant="destructive" size="sm" onClick={markLost}>
              <XCircle className="mr-1.5 h-4 w-4" />
              Marcar perda
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={markWon}>
              <Trophy className="mr-1.5 h-4 w-4" />
              Marcar venda
            </Button>
          </div>
        </div>
      </div>

      {/* Stage bar */}
      {stages && stages.length > 0 && (
        <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1">
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => void moveToStage(s.id)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all whitespace-nowrap",
                s.id === deal.stage_id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Deal info */}
          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <h3 className="font-semibold">Negociação</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Nome</dt>
                  <dd className="font-medium text-right">{deal.title}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Criada em</dt>
                  <dd>{format(new Date(deal.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</dd>
                </div>
                {deal.value != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Valor total</dt>
                    <dd className="font-semibold text-green-600">
                      R$ {Number(deal.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <dt className="text-muted-foreground">Responsável</dt>
                  <dd>
                    <Select value={deal.representative_id} onValueChange={changeResponsible}>
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(allReps ?? []).map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </dd>
                </div>
                {deal.lost_reason && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Motivo perda</dt>
                    <dd className="text-red-500 text-right">{deal.lost_reason}</dd>
                  </div>
                )}
              </dl>
              {deal.notes && (
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">{deal.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact */}
          {deal.client && (
            <Card>
              <CardContent className="space-y-2 p-4 text-sm">
                <h3 className="font-semibold">Contato</h3>
                <p className="font-medium">{deal.client.name}</p>
                {deal.client.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{deal.client.email}</span>
                  </div>
                )}
                {deal.client.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{deal.client.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Company */}
          {deal.company && (
            <Card>
              <CardContent className="space-y-2 p-4 text-sm">
                <h3 className="font-semibold">Empresa</h3>
                <p className="font-medium">{deal.company.name}</p>
                {deal.company.cnpj && <p className="text-xs text-muted-foreground font-mono">CNPJ: {deal.company.cnpj}</p>}
                {(deal.company.city || deal.company.state) && (
                  <p className="text-xs text-muted-foreground">
                    {deal.company.city}{deal.company.state ? ` - ${deal.company.state}` : ""}
                  </p>
                )}
                {deal.company.segment && <Badge variant="secondary" className="text-xs">{deal.company.segment}</Badge>}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main content */}
        <div className="space-y-6">
          {/* Pending tasks */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Próximas tarefas</h3>
                <Button size="sm" onClick={() => setCreateTaskOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Criar tarefa
                </Button>
              </div>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente.</p>
              ) : (
                <div className="space-y-2">
                  {pendingTasks.map((t) => {
                    const taskType = TASK_TYPES.find((tt) => tt.value === t.type);
                    const Icon = taskType?.icon ?? CheckCircle2;
                    const isOverdue = t.due_date && isPast(parseISO(t.due_date));
                    return (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{t.subject || taskType?.label || t.type}</p>
                            {t.description && t.description !== t.subject && (
                              <p className="text-xs text-muted-foreground">{t.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px]">
                              {isOverdue ? "ATRASADA" : "ABERTA"}
                            </Badge>
                            {t.due_date && (
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {format(parseISO(t.due_date), "dd/MM/yyyy HH:mm")}
                              </p>
                            )}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => void completeTask(t.id)}>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add note */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Adicionar anotação…"
                  onKeyDown={(e) => { if (e.key === "Enter") void addNote(); }}
                  className="flex-1"
                />
                <Button onClick={addNote} disabled={!noteText.trim()}>
                  + Criar anotação
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-4 font-semibold">Histórico</h3>
              {!activities?.length ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((a) => {
                    const taskType = TASK_TYPES.find((tt) => tt.value === a.type);
                    const Icon = a.type === "stage_change" ? ArrowRight
                      : a.type === "note" ? MessageSquare
                      : taskType?.icon ?? MessageSquare;
                    return (
                      <div key={a.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full",
                            a.type === "stage_change" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                              : a.type === "note" ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              : "bg-primary/10 text-primary",
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="mt-1 h-full w-px bg-border" />
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {a.subject && <p className="text-sm font-medium">{a.subject}</p>}
                              <p className={cn("text-sm", a.subject ? "text-muted-foreground" : "text-foreground")}>
                                {a.description}
                              </p>
                            </div>
                            {a.completed && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">Concluída</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Task Dialog */}
      {createTaskOpen && (
        <CreateTaskInDealDialog
          dealId={id}
          dealTitle={deal.title}
          onClose={() => { setCreateTaskOpen(false); void refetchActivities(); }}
        />
      )}

      {/* Transfer Dialog */}
      {transferOpen && (
        <TransferDealDialog
          dealId={id}
          currentPipelineId={deal.pipeline_id}
          onClose={() => { setTransferOpen(false); void refetch(); void refetchActivities(); }}
        />
      )}
    </div>
  );
}

function CreateTaskInDealDialog({ dealId, dealTitle, onClose }: { dealId: string; dealTitle: string; onClose: () => void }) {
  const { profile } = useAuth();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("call");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueTime, setDueTime] = useState("09:00");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!subject.trim()) { toast.error("Informe o assunto"); return; }
    setBusy(true);
    const { error } = await supabase.from("deal_activities").insert({
      deal_id: dealId,
      user_id: profile?.id,
      assigned_to: profile?.id,
      type,
      subject: subject.trim(),
      description: description.trim() || subject.trim(),
      due_date: `${dueDate}T${dueTime}:00`,
      completed: false,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarefa criada!");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Negociação</Label>
            <Input value={dealTitle} disabled className="bg-muted/50" />
          </div>
          <div>
            <Label className="text-xs">Assunto da tarefa *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto da tarefa" />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Descrição da tarefa" />
          </div>
          <div>
            <Label className="text-xs">Tipo de tarefa *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Horário *</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Criando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDealDialog({ dealId, currentPipelineId, onClose }: { dealId: string; currentPipelineId: string | null; onClose: () => void }) {
  const { profile } = useAuth();
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [reps, setReps] = useState<{ id: string; full_name: string }[]>([]);
  const [targetPipeline, setTargetPipeline] = useState("");
  const [targetStage, setTargetStage] = useState("");
  const [targetRep, setTargetRep] = useState(profile?.id ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.from("pipelines").select("id, name").order("position").then(({ data }) => {
      const list = (data ?? []) as { id: string; name: string }[];
      setPipelines(list);
      // Pre-select a different pipeline than current
      const other = list.find((p) => p.id !== currentPipelineId);
      if (other) setTargetPipeline(other.id);
      else if (list.length) setTargetPipeline(list[0].id);
    });
    void supabase.from("profiles").select("id, full_name").order("full_name").then(({ data }) => {
      setReps((data ?? []) as { id: string; full_name: string }[]);
    });
  }, [currentPipelineId]);

  useEffect(() => {
    if (!targetPipeline) return;
    void supabase
      .from("deal_stages")
      .select("id, name")
      .eq("pipeline_id", targetPipeline)
      .order("position")
      .then(({ data }) => {
        const list = (data ?? []) as { id: string; name: string }[];
        setStages(list);
        if (list.length) setTargetStage(list[0].id);
      });
  }, [targetPipeline]);

  const submit = async () => {
    if (!targetPipeline || !targetStage) { toast.error("Selecione funil e estágio"); return; }
    setBusy(true);

    const { error } = await supabase.from("deals").update({
      pipeline_id: targetPipeline,
      stage_id: targetStage,
      representative_id: targetRep || undefined,
    }).eq("id", dealId);

    if (error) { toast.error(error.message); setBusy(false); return; }

    const pipelineName = pipelines.find((p) => p.id === targetPipeline)?.name ?? "";
    const repName = reps.find((r) => r.id === targetRep)?.full_name ?? "";

    await supabase.from("deal_activities").insert({
      deal_id: dealId,
      user_id: profile?.id,
      type: "stage_change",
      description: `Transferido para funil "${pipelineName}"${repName ? ` — responsável: ${repName}` : ""}`,
    });

    setBusy(false);
    toast.success("Negociação transferida!");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir negociação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Funil destino *</Label>
            <Select value={targetPipeline} onValueChange={setTargetPipeline}>
              <SelectTrigger><SelectValue placeholder="Selecionar funil" /></SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Estágio de entrada *</Label>
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger><SelectValue placeholder="Selecionar estágio" /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Novo responsável</Label>
            <Select value={targetRep} onValueChange={setTargetRep}>
              <SelectTrigger><SelectValue placeholder="Manter atual" /></SelectTrigger>
              <SelectContent>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Transferindo…" : "Transferir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
