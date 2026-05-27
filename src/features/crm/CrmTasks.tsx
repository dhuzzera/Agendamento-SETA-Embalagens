import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Phone,
  Mail,
  MapPin,
  Users,
  CheckSquare,
  Coffee,
  MessageCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

const TASK_TYPES = [
  { value: "call", label: "Ligação", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "visit", label: "Visita", icon: MapPin },
  { value: "meeting", label: "Reunião", icon: Users },
  { value: "task", label: "Tarefa", icon: CheckSquare },
  { value: "lunch", label: "Almoço", icon: Coffee },
  { value: "whatsapp", label: "Whatsapp", icon: MessageCircle },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendentes" },
  { value: "overdue", label: "Atrasadas" },
  { value: "completed", label: "Concluídas" },
  { value: "all", label: "Todos os status" },
];

type Task = {
  id: string;
  deal_id: string;
  type: string;
  subject: string | null;
  description: string;
  due_date: string | null;
  completed: boolean;
  assigned_to: string | null;
  created_at: string;
  deal_title?: string;
  company_name?: string;
};

export function CrmTasks() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ["crm-tasks", profile?.id, typeFilter, statusFilter],
    enabled: !!profile,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("deal_activities")
        .select("id, deal_id, type, subject, description, due_date, completed, assigned_to, created_at")
        .in("type", ["call", "email", "visit", "meeting", "task", "lunch", "whatsapp"])
        .order("due_date", { ascending: true, nullsFirst: false });

      // Filter by assigned user (default: mine)
      q = q.eq("assigned_to", profile!.id);

      if (typeFilter !== "all") {
        q = q.eq("type", typeFilter);
      }

      if (statusFilter === "pending") {
        q = q.eq("completed", false);
      } else if (statusFilter === "overdue") {
        q = q.eq("completed", false).lt("due_date", new Date().toISOString());
      } else if (statusFilter === "completed") {
        q = q.eq("completed", true);
      }

      const { data } = await q.limit(100);
      if (!data?.length) return [];

      // Enrich with deal titles
      const dealIds = [...new Set(data.map((t) => t.deal_id))];
      const { data: deals } = await supabase
        .from("deals")
        .select("id, title")
        .in("id", dealIds);
      const dealMap = new Map((deals ?? []).map((d) => [d.id, d.title]));

      return data.map((t) => ({
        ...t,
        deal_title: dealMap.get(t.deal_id) ?? "—",
      })) as Task[];
    },
  });

  const toggleComplete = async (task: Task) => {
    const { error } = await supabase
      .from("deal_activities")
      .update({ completed: !task.completed })
      .eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    toast.success(task.completed ? "Tarefa reaberta" : "Tarefa concluída!");
    void refetch();
  };

  const getTypeIcon = (type: string) => {
    const t = TASK_TYPES.find((tt) => tt.value === type);
    if (!t) return <CheckSquare className="h-4 w-4" />;
    const Icon = t.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getStatusBadge = (task: Task) => {
    if (task.completed) {
      return <Badge variant="secondary" className="text-xs">Concluída</Badge>;
    }
    if (task.due_date && isPast(parseISO(task.due_date))) {
      return <Badge variant="destructive" className="text-xs">Atrasada</Badge>;
    }
    return <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Criar tarefa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TASK_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left font-medium">Tarefa</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Data e hora</th>
                  <th className="px-4 py-3 text-left font-medium">Negociação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-4"><ListRowSkeleton /></td></tr>
                  ))
                ) : tasks?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma tarefa encontrada.
                    </td>
                  </tr>
                ) : (
                  tasks?.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={t.completed}
                          onCheckedChange={() => void toggleComplete(t)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{getTypeIcon(t.type)}</span>
                          <span className={t.completed ? "line-through text-muted-foreground" : "font-medium"}>
                            {t.subject || TASK_TYPES.find((tt) => tt.value === t.type)?.label || t.type}
                          </span>
                        </div>
                        {t.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(t)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.due_date
                          ? format(parseISO(t.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-primary">{t.deal_title}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {createOpen && <CreateTaskDialog onClose={() => { setCreateOpen(false); void refetch(); }} />}
    </div>
  );
}

function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [dealId, setDealId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("task");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueTime, setDueTime] = useState("09:00");
  const [busy, setBusy] = useState(false);

  // Load deals for select
  const { data: deals } = useQuery({
    queryKey: ["crm-deals-select"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, title")
        .order("updated_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!dealId) { toast.error("Selecione a negociação"); return; }
    if (!subject.trim()) { toast.error("Informe o assunto"); return; }
    setBusy(true);

    const dueDatetime = `${dueDate}T${dueTime}:00`;

    const { error } = await supabase.from("deal_activities").insert({
      deal_id: dealId,
      user_id: profile?.id,
      assigned_to: profile?.id,
      type,
      subject: subject.trim(),
      description: description.trim() || subject.trim(),
      due_date: dueDatetime,
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
            <Label className="text-xs">Negociação *</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {(deals ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
