import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

type PendingAppt = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  meeting_type: string;
  client_name: string;
  client_company: string | null;
};

type MeetingResult = "venda_fechada" | "em_negociacao" | "proposta_reprovada";

export function PendingConfirmationDialog() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<PendingAppt[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Formulário de conclusão
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [result, setResult] = useState<MeetingResult | "">("");
  const [saleValue, setSaleValue] = useState("");
  const [budgetCode, setBudgetCode] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [negotiationDetails, setNegotiationDetails] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const currentTime = now.toTimeString().slice(0, 8);

      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, end_time, meeting_type, client_id")
        .eq("representative_id", profile.id)
        .eq("status", "scheduled")
        .or(`appointment_date.lt.${todayStr},and(appointment_date.eq.${todayStr},end_time.lt.${currentTime})`)
        .order("appointment_date", { ascending: false })
        .limit(20);

      if (!data || data.length === 0) return;

      const clientIds = [...new Set(data.map((a) => a.client_id))];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, company")
        .in("id", clientIds);

      const clientMap = new Map((clients ?? []).map((c) => [c.id, { name: c.name, company: c.company }]));

      const items: PendingAppt[] = data.map((a) => ({
        id: a.id,
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        end_time: a.end_time,
        meeting_type: a.meeting_type,
        client_name: clientMap.get(a.client_id)?.name ?? "—",
        client_company: clientMap.get(a.client_id)?.company ?? null,
      }));

      setPending(items);
      if (items.length > 0) setOpen(true);
    };
    void load();
  }, [profile]);

  const resetForm = () => {
    setResult("");
    setSaleValue("");
    setBudgetCode("");
    setOrderCode("");
    setNegotiationDetails("");
    setRejectionReason("");
    setCompletingId(null);
  };

  const submitCompletion = async () => {
    if (!completingId || !result) {
      toast.error("Selecione o resultado da reunião.");
      return;
    }

    if (result === "venda_fechada" && (!saleValue.trim() || !budgetCode.trim() || !orderCode.trim())) {
      toast.error("Preencha valor da venda, código do orçamento e código do pedido.");
      return;
    }
    if (result === "em_negociacao" && !negotiationDetails.trim()) {
      toast.error("Descreva o que está sendo negociado.");
      return;
    }
    if (result === "proposta_reprovada" && !rejectionReason.trim()) {
      toast.error("Informe o motivo da reprovação.");
      return;
    }

    setBusy(completingId);

    const resultNotes = result === "venda_fechada"
      ? `Valor: R$ ${saleValue} | Orçamento: ${budgetCode} | Pedido: ${orderCode}`
      : result === "em_negociacao"
        ? negotiationDetails
        : rejectionReason;

    const { error } = await supabase
      .from("appointments")
      .update({
        status: "completed",
        meeting_result: result,
        sale_value: result === "venda_fechada" ? saleValue.trim() : null,
        budget_code: result === "venda_fechada" ? budgetCode.trim() : null,
        order_code: result === "venda_fechada" ? orderCode.trim() : null,
        result_notes: resultNotes.trim() || null,
      })
      .eq("id", completingId);

    setBusy(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Reunião concluída com sucesso!");
    const remaining = pending.filter((p) => p.id !== completingId);
    setPending(remaining);
    resetForm();
    if (remaining.length === 0) setOpen(false);
  };

  const markCancelled = async (id: string) => {
    setBusy(id);
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    setBusy(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Marcada como cancelada");
    const remaining = pending.filter((p) => p.id !== id);
    setPending(remaining);
    if (remaining.length === 0) setOpen(false);
  };

  if (!open || pending.length === 0) return null;

  // Formulário de conclusão
  if (completingId) {
    const appt = pending.find((p) => p.id === completingId);
    return (
      <Dialog open={true} onOpenChange={() => {}} >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Concluir reunião</DialogTitle>
            <DialogDescription>
              {appt && `${appt.client_name} — ${format(new Date(appt.appointment_date + "T00:00"), "dd/MM/yyyy", { locale: ptBR })} às ${appt.start_time.slice(0, 5)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <Label className="text-sm font-medium">Resultado da reunião *</Label>
              <Select value={result} onValueChange={(v) => setResult(v as MeetingResult)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o resultado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda_fechada">✅ Venda fechada</SelectItem>
                  <SelectItem value="em_negociacao">🔄 Em negociação</SelectItem>
                  <SelectItem value="proposta_reprovada">❌ Proposta reprovada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {result === "venda_fechada" && (
              <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800/40 dark:bg-green-900/20">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Dados da venda</p>
                <div>
                  <Label className="text-xs">Valor da venda (R$) *</Label>
                  <Input value={saleValue} onChange={(e) => setSaleValue(e.target.value)} placeholder="Ex: 15.000,00" />
                </div>
                <div>
                  <Label className="text-xs">Código do orçamento *</Label>
                  <Input value={budgetCode} onChange={(e) => setBudgetCode(e.target.value)} placeholder="Ex: ORC-2026-0042" />
                </div>
                <div>
                  <Label className="text-xs">Código do pedido *</Label>
                  <Input value={orderCode} onChange={(e) => setOrderCode(e.target.value)} placeholder="Ex: PED-2026-0018" />
                </div>
              </div>
            )}

            {result === "em_negociacao" && (
              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/40 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Detalhes da negociação</p>
                <div>
                  <Label className="text-xs">O que está sendo negociado? *</Label>
                  <Textarea
                    value={negotiationDetails}
                    onChange={(e) => setNegotiationDetails(e.target.value)}
                    rows={3}
                    placeholder="Ex: Cliente pediu desconto de 10% no lote de caixas personalizadas. Aguardando aprovação do gerente comercial."
                  />
                </div>
              </div>
            )}

            {result === "proposta_reprovada" && (
              <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-900/20">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Motivo da reprovação</p>
                <div>
                  <Label className="text-xs">Por que a proposta foi reprovada? *</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="Ex: Preço acima do concorrente / Cliente optou por outro fornecedor / Prazo de entrega não atendeu / Produto não atende a especificação"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm} disabled={busy === completingId}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={submitCompletion} disabled={busy === completingId || !result} className="flex-1">
                {busy === completingId ? "Salvando..." : "Concluir reunião"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Lista de pendentes
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Reuniões pendentes de confirmação</DialogTitle>
          <DialogDescription>
            Você tem {pending.length} {pending.length === 1 ? "reunião que já passou" : "reuniões que já passaram"} sem confirmação.
            Marque cada uma como <strong>concluída</strong> ou <strong>cancelada</strong> para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {pending.map((appt) => (
            <div key={appt.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{appt.client_name}</div>
                  {appt.client_company && (
                    <div className="text-sm text-muted-foreground">{appt.client_company}</div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {format(new Date(appt.appointment_date + "T00:00"), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                    </span>
                    <span>•</span>
                    <span>{appt.start_time.slice(0, 5)} – {appt.end_time.slice(0, 5)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {appt.meeting_type === "presencial" ? "Presencial" : "Online"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setCompletingId(appt.id)}
                  disabled={busy === appt.id}
                  className="flex-1"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Concluída
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => markCancelled(appt.id)}
                  disabled={busy === appt.id}
                  className="flex-1"
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Cancelada
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
