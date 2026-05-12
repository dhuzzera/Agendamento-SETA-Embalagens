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
import { MapPin, Copy, ExternalLink, CalendarPlus, Download, Mail } from "lucide-react";
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  type CalendarEvent,
} from "@/lib/calendar";

type Status = "scheduled" | "completed" | "cancelled" | "rescheduled";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export type AppointmentDetails = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: Status;
  notes: string | null;
  representative_id: string;
  meeting_type?: "online" | "presencial" | string;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<Status>("scheduled");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setDate(appointment.appointment_date);
    setStartTime(appointment.start_time.slice(0, 5));
    setEndTime(appointment.end_time.slice(0, 5));
    setStatus(appointment.status);
    setNotes(appointment.notes ?? "");
    setCity(appointment.city ?? "");
    setStateUf(appointment.state ?? "");
    setLocation(appointment.location ?? "");
    // load internal notes fresh (admin only)
    if (isAdmin) {
      void supabase
        .from("appointments")
        .select("internal_notes")
        .eq("id", appointment.id)
        .maybeSingle()
        .then(({ data }) => setInternalNotes((data?.internal_notes as string) ?? ""));
    } else {
      setInternalNotes("");
    }
  }, [appointment, isAdmin]);

  if (!appointment) return null;

  const save = async () => {
    setSaving(true);
    const isPresencial = appointment.meeting_type === "presencial";
    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: date,
        start_time: startTime + ":00",
        end_time: endTime + ":00",
        status,
        notes: notes || null,
        internal_notes: internalNotes || null,
        ...(isPresencial
          ? {
              city: city.trim() || null,
              state: stateUf.trim() ? stateUf.trim().toUpperCase() : null,
              location: location.trim() || null,
            }
          : {}),
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

          {appointment.meeting_type === "presencial" && appointment.location && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Endereço da reunião presencial
              </div>
              <p className="whitespace-pre-wrap text-sm">{appointment.location}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Abrir no Google Maps
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(appointment.location ?? "");
                      toast.success("Endereço copiado");
                    } catch {
                      toast.error("Não foi possível copiar");
                    }
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
              {appointment.latitude != null && appointment.longitude != null && (
                <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs">
                  <div className="mb-1 font-medium text-primary">📍 Localização precisa do cliente</div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-muted-foreground">
                      {appointment.latitude.toFixed(6)}, {appointment.longitude.toFixed(6)}
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${appointment.latitude},${appointment.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Abrir no mapa
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {appointment.status !== "cancelled" && (() => {
            const isPresencial = appointment.meeting_type === "presencial";
            const modalidade = isPresencial ? "Presencial" : "Online";
            const descLines = [`Modalidade: ${modalidade}`];
            if (isPresencial && appointment.location)
              descLines.push(`Endereço: ${appointment.location}`);
            if (appointment.notes) descLines.push(`Observações: ${appointment.notes}`);
            const ensureSec = (t: string) => (t.length === 5 ? `${t}:00` : t);
            const event: CalendarEvent = {
              title: `Reunião ${modalidade} — ${appointment.client.name}${
                appointment.client.company ? ` (${appointment.client.company})` : ""
              }`,
              description: descLines.join("\n"),
              location:
                isPresencial && appointment.location ? appointment.location : undefined,
              date: date || appointment.appointment_date,
              startTime: ensureSec(startTime || appointment.start_time),
              endTime: ensureSec(endTime || appointment.end_time),
              attendeeEmail: appointment.client.email,
              attendeeName: appointment.client.name,
              uid: `appointment-${appointment.id}@seta-agende`,
            };
            return (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <CalendarPlus className="h-3.5 w-3.5" /> Adicionar ao calendário
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Use após remarcar para atualizar o convite com o novo horário, modalidade
                  {isPresencial ? " e endereço" : ""}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={buildGoogleCalendarUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Google Calendar
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadIcsFile(event, `reuniao-${appointment.id}.ics`)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Baixar .ics (Outlook/Apple)
                  </Button>
                </div>
              </div>
            );
          })()}

          {isAdmin ? (
            <>
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

              {appointment.meeting_type === "presencial" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Joinville" />
                  </div>
                  <div>
                    <Label className="text-xs">UF</Label>
                    <Select value={stateUf} onValueChange={setStateUf}>
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_LIST.map((uf) => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs">Endereço</Label>
                    <Textarea
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      rows={2}
                      placeholder="Rua, número, bairro"
                    />
                  </div>
                </div>
              )}

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
            </>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Data</div>
                  <div className="font-medium">
                    {format(new Date(appointment.appointment_date + "T00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Início</div>
                  <div className="font-medium">{appointment.start_time.slice(0, 5)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fim</div>
                  <div className="font-medium">{appointment.end_time.slice(0, 5)}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant="outline">{labelStatus(appointment.status)}</Badge>
              </div>
              {appointment.notes && (
                <div>
                  <div className="text-xs text-muted-foreground">Observações do cliente</div>
                  <p className="whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              )}
            </div>
          )}
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
            {isAdmin && (
              <Button onClick={save} disabled={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function labelStatus(s: string) {
  return (
    {
      scheduled: "Agendado",
      completed: "Concluído",
      cancelled: "Cancelado",
      rescheduled: "Remarcado",
    } as Record<string, string>
  )[s] ?? s;
}
