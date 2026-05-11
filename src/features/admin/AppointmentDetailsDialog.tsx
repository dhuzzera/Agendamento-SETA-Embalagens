import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Status = "scheduled" | "completed" | "cancelled" | "rescheduled";

export type AppointmentDetails = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: Status;
  notes: string | null;
  representative_id: string;
  client: {
    name: string;
    company: string | null;
    email: string;
    phone: string | null;
  };
};

type Props = {
  appointment: AppointmentDetails | null;
  representativeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

export function AppointmentDetailsDialog({
  appointment,
  representativeName,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<Status>("scheduled");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setDate(appointment.appointment_date);
    setStartTime(appointment.start_time.slice(0, 5));
    setEndTime(appointment.end_time.slice(0, 5));
    setStatus(appointment.status);
    setNotes(appointment.notes ?? "");
    // load internal notes fresh
    void supabase
      .from("appointments")
      .select("internal_notes")
      .eq("id", appointment.id)
      .maybeSingle()
      .then(({ data }) => setInternalNotes((data?.internal_notes as string) ?? ""));
  }, [appointment]);

  if (!appointment) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: date,
        start_time: startTime + ":00",
        end_time: endTime + ":00",
        status,
        notes: notes || null,
        internal_notes: internalNotes || null,
      })
      .eq("id", appointment.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agendamento atualizado");
    onChanged();
    onOpenChange(false);
  };

  const cancelAppt = async () => {
    if (!confirm("Cancelar este agendamento?")) return;
    setCancelling(true);
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointment.id);
    setCancelling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agendamento cancelado");
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes do agendamento</DialogTitle>
          <DialogDescription>
            {format(new Date(appointment.appointment_date + "T00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{appointment.client.name}</div>
            {appointment.client.company && (
              <div className="text-muted-foreground">{appointment.client.company}</div>
            )}
            <div className="text-muted-foreground">
              {appointment.client.email}
              {appointment.client.phone && ` • ${appointment.client.phone}`}
            </div>
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                Representante: {representativeName}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="rescheduled">Remarcado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Observações do cliente</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Sem observações"
            />
          </div>

          <div>
            <Label className="text-xs">Notas internas (não visíveis ao cliente)</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              placeholder="Anotações internas do time"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {appointment.status !== "cancelled" ? (
            <Button
              variant="destructive"
              onClick={cancelAppt}
              disabled={cancelling || saving}
            >
              {cancelling ? "Cancelando…" : "Cancelar agendamento"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Fechar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
