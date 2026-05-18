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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle } from "lucide-react";

type PendingAppt = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  meeting_type: string;
  client_name: string;
  client_company: string | null;
};

/**
 * Dialog obrigatório que aparece quando o representante tem reuniões passadas
 * ainda com status "scheduled". Ele precisa marcar cada uma como concluída ou cancelada.
 */
export function PendingConfirmationDialog() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<PendingAppt[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const currentTime = now.toTimeString().slice(0, 8);

      // Busca reuniões passadas que ainda estão como "scheduled"
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, end_time, meeting_type, client_id")
        .eq("representative_id", profile.id)
        .eq("status", "scheduled")
        .or(`appointment_date.lt.${todayStr},and(appointment_date.eq.${todayStr},end_time.lt.${currentTime})`)
        .order("appointment_date", { ascending: false })
        .limit(20);

      if (!data || data.length === 0) return;

      // Busca nomes dos clientes
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

  const markStatus = async (id: string, status: "completed" | "cancelled") => {
    setBusy(id);
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);
    setBusy(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(status === "completed" ? "Marcada como concluída" : "Marcada como cancelada");
    const remaining = pending.filter((p) => p.id !== id);
    setPending(remaining);
    if (remaining.length === 0) setOpen(false);
  };

  if (!open || pending.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={() => { /* não permite fechar sem resolver */ }}>
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
                  onClick={() => markStatus(appt.id, "completed")}
                  disabled={busy === appt.id}
                  className="flex-1"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Concluída
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => markStatus(appt.id, "cancelled")}
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
