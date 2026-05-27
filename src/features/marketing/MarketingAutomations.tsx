import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Zap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

const TRIGGER_LABELS: Record<string, string> = {
  deal_inactive: "Deal inativo por X dias",
  stage_change: "Mudança de estágio",
  new_lead: "Novo lead criado",
  appointment_created: "Reunião agendada",
  custom: "Personalizado",
};

const ACTION_LABELS: Record<string, string> = {
  send_email: "Enviar e-mail",
  create_task: "Criar tarefa",
  move_stage: "Mover estágio",
  notify: "Notificar responsável",
};

export function MarketingAutomations() {
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: automations, isLoading, refetch } = useQuery({
    queryKey: ["marketing-automations"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("automations").update({ active: !active }).eq("id", id);
    void refetch();
    toast.success(active ? "Automação desativada" : "Automação ativada");
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm("Excluir esta automação?")) return;
    await supabase.from("automations").delete().eq("id", id);
    toast.success("Automação excluída");
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automações</h1>
          <p className="text-muted-foreground">Regras automáticas que executam ações baseadas em eventos.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova automação
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><ListRowSkeleton /><ListRowSkeleton /></div>
          ) : !automations?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma automação criada.</p>
          ) : (
            <div className="divide-y">
              {automations.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className={`h-4 w-4 ${a.active ? "text-yellow-500" : "text-muted-foreground"}`} />
                      <span className="font-medium">{a.name}</span>
                      {!a.active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Quando: {TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type} → {ACTION_LABELS[a.action_type] ?? a.action_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={a.active} onCheckedChange={() => void toggleActive(a.id, a.active)} />
                    <Button size="sm" variant="ghost" onClick={() => void deleteAutomation(a.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && <CreateAutomationDialog onClose={() => { setCreateOpen(false); void refetch(); }} />}
    </div>
  );
}

function CreateAutomationDialog({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("deal_inactive");
  const [actionType, setActionType] = useState("send_email");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    setBusy(true);
    const { error } = await supabase.from("automations").insert({
      name: name.trim(),
      trigger_type: triggerType,
      action_type: actionType,
      trigger_config: {},
      action_config: {},
      active: true,
      created_by: profile?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Automação criada!");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova automação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lembrete deal parado" /></div>
          <div>
            <Label className="text-xs">Quando (trigger)</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deal_inactive">Deal inativo por X dias</SelectItem>
                <SelectItem value="stage_change">Mudança de estágio</SelectItem>
                <SelectItem value="new_lead">Novo lead criado</SelectItem>
                <SelectItem value="appointment_created">Reunião agendada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ação</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="send_email">Enviar e-mail</SelectItem>
                <SelectItem value="create_task">Criar tarefa</SelectItem>
                <SelectItem value="move_stage">Mover estágio</SelectItem>
                <SelectItem value="notify">Notificar responsável</SelectItem>
              </SelectContent>
            </Select>
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
