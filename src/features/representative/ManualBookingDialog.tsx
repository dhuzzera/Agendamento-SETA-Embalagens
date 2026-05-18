import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode";
import {
  Dialog,
  DialogContent,
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
import { toast } from "sonner";
import { format } from "date-fns";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function ManualBookingDialog({ open, onOpenChange, onCreated }: Props) {
  const { profile, role } = useAuth();
  const [viewMode] = useViewMode();
  const isAdmin = role === "admin" && viewMode === "admin";

  const [reps, setReps] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetingType, setMeetingType] = useState<"online" | "presencial">("online");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Carrega lista de representantes para admin
  useEffect(() => {
    if (!isAdmin) return;
    void supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name")
      .then(({ data }) => setReps((data ?? []) as { id: string; full_name: string }[]));
  }, [isAdmin]);

  const reset = () => {
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setMeetingType("online");
    setCity("");
    setStateUf("");
    setLocation("");
    setNotes("");
    setSelectedRepId("");
  };

  const submit = async () => {
    if (!profile) return;

    const repId = isAdmin ? selectedRepId : profile.id;
    if (isAdmin && !repId) {
      toast.error("Selecione um representante.");
      return;
    }

    if (!name.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail do cliente.");
      return;
    }
    if (!date || !startTime || !endTime) {
      toast.error("Preencha data, horário de início e fim.");
      return;
    }
    if (startTime >= endTime) {
      toast.error("Horário de fim deve ser maior que o início.");
      return;
    }
    if (meetingType === "presencial" && (!city.trim() || !location.trim())) {
      toast.error("Preencha cidade e endereço para reunião presencial.");
      return;
    }

    setBusy(true);
    try {
      // Cria o cliente
      const clientId = crypto.randomUUID();
      const { error: cErr } = await supabase.from("clients").insert({
        id: clientId,
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
      });
      if (cErr) throw cErr;

      // Cria o agendamento
      const { error: aErr } = await supabase.from("appointments").insert({
        representative_id: repId,
        client_id: clientId,
        appointment_date: date,
        start_time: startTime + ":00",
        end_time: endTime + ":00",
        meeting_type: meetingType,
        city: meetingType === "presencial" ? city.trim() : null,
        state: meetingType === "presencial" ? stateUf.trim().toUpperCase() : null,
        location: meetingType === "presencial" ? location.trim() : null,
        notes: notes.trim() || null,
      });
      if (aErr) throw aErr;

      toast.success("Agendamento criado com sucesso!");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar agendamento";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Crie um agendamento para qualquer representante."
              : "Crie um agendamento para um cliente que teve dificuldade em usar o link público."}
          </p>

          {isAdmin && (
            <div>
              <Label className="text-xs">Representante *</Label>
              <Select value={selectedRepId} onValueChange={setSelectedRepId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o representante" />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nome do cliente *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="João Silva" />
            </div>
            <div>
              <Label className="text-xs">Empresa</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa Ltda" />
            </div>
            <div>
              <Label className="text-xs">E-mail *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={format(new Date(), "yyyy-MM-dd")} />
            </div>
            <div>
              <Label className="text-xs">Início *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fim *</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Modalidade</Label>
            <Select value={meetingType} onValueChange={(v) => setMeetingType(v as "online" | "presencial")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {meetingType === "presencial" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Cidade *</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Joinville" />
              </div>
              <div>
                <Label className="text-xs">UF</Label>
                <Input value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="SC" maxLength={2} />
              </div>
              <div className="sm:col-span-3">
                <Label className="text-xs">Endereço *</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Rua, número, bairro" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Informações adicionais..." />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Criando..." : "Criar agendamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
