import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trash2,
  Plus,
  Apple,
  Copy,
  CalendarPlus,
  Pencil,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Smartphone,
  Mail,
  ExternalLink,
  Info,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ChangeLogCard } from "./ChangeLogCard";

type Avail = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  meeting_duration_min: number;
  active: boolean;
};

type Block = {
  id: string;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export function AvailabilityManager() {
  const { profile } = useAuth();
  const [avails, setAvails] = useState<Avail[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);

  // form
  const [wd, setWd] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [dur, setDur] = useState(30);

  // block form
  const [blockDate, setBlockDate] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const load = async () => {
    if (!profile) return;
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase
        .from("availabilities")
        .select("*")
        .eq("representative_id", profile.id)
        .order("weekday"),
      supabase
        .from("blocks")
        .select("*")
        .eq("representative_id", profile.id)
        .order("block_date", { ascending: false }),
    ]);
    setAvails((a as Avail[]) ?? []);
    setBlocks((b as Block[]) ?? []);
  };

  useEffect(() => {
    void load();
    if (profile) {
      void supabase
        .from("profiles")
        .select("calendar_token")
        .eq("id", profile.id)
        .maybeSingle()
        .then(({ data }) => setCalendarToken((data?.calendar_token as string) ?? null));
    }
  }, [profile]);

  const addAvail = async () => {
    if (!profile) return;
    const { error } = await supabase.from("availabilities").insert({
      representative_id: profile.id,
      weekday: wd,
      start_time: start,
      end_time: end,
      meeting_duration_min: dur,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Disponibilidade adicionada");
      void load();
    }
  };

  const removeAvail = async (id: string) => {
    await supabase.from("availabilities").delete().eq("id", id);
    void load();
  };

  const updateAvail = async (id: string, patch: Partial<Avail>) => {
    const { error } = await supabase.from("availabilities").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Disponibilidade atualizada");
    void load();
    return true;
  };

  const toggleActive = async (a: Avail) => {
    await updateAvail(a.id, { active: !a.active });
  };

  const addBlock = async () => {
    if (!profile || !blockDate) return;
    const partial = blockStart && blockEnd;
    if ((blockStart && !blockEnd) || (!blockStart && blockEnd)) {
      toast.error("Informe início e fim do horário, ou deixe ambos vazios para bloquear o dia todo.");
      return;
    }
    if (partial && blockStart >= blockEnd) {
      toast.error("Horário final deve ser maior que o inicial.");
      return;
    }
    const { error } = await supabase.from("blocks").insert({
      representative_id: profile.id,
      block_date: blockDate,
      start_time: partial ? blockStart : null,
      end_time: partial ? blockEnd : null,
      reason: blockReason || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Bloqueio criado");
      setBlockDate("");
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      void load();
    }
  };

  const removeBlock = async (id: string) => {
    await supabase.from("blocks").delete().eq("id", id);
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Disponibilidade</h1>
        <p className="text-muted-foreground">
          Defina seus horários de atendimento e bloqueios.
        </p>
      </div>

      <CalendarSubscriptionCard token={calendarToken} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Horários semanais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">Dia</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={wd}
                  onChange={(e) => setWd(parseInt(e.target.value))}
                >
                  {WEEKDAYS.map((w, i) => (
                    <option key={i} value={i}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Input
                  type="number"
                  value={dur}
                  onChange={(e) => setDur(parseInt(e.target.value) || 30)}
                />
              </div>
              <Button onClick={addAvail} className="self-end">
                <Plus className="mr-1.5 h-4 w-4" /> Adicionar
              </Button>
            </div>

            <div className="divide-y rounded-md border">
              {avails.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  Nenhuma disponibilidade.
                </p>
              )}
              {avails.map((a) => (
                <AvailRow
                  key={a.id}
                  avail={a}
                  onRemove={() => removeAvail(a.id)}
                  onSave={(patch) => updateAvail(a.id, patch)}
                  onToggle={() => toggleActive(a)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bloqueios e feriados</CardTitle>
            <p className="text-xs text-muted-foreground">
              Desative uma data específica sem alterar seu horário recorrente. Deixe os
              horários vazios para bloquear o dia inteiro, ou preencha para bloquear só
              uma faixa.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_1fr_auto] sm:items-end">
              <div>
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">De (opcional)</Label>
                <Input
                  type="time"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Até (opcional)</Label>
                <Input
                  type="time"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Motivo</Label>
                <Input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Férias, feriado, compromisso…"
                />
              </div>
              <Button onClick={addBlock}>
                <Plus className="mr-1.5 h-4 w-4" /> Bloquear
              </Button>
            </div>

            <div className="divide-y rounded-md border">
              {blocks.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Nenhum bloqueio.</p>
              )}
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3">
                  <div className="text-sm">
                    <span className="font-medium">{formatDate(b.block_date)}</span>
                    <span className="text-muted-foreground">
                      {" "}•{" "}
                      {b.start_time && b.end_time
                        ? `${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`
                        : "dia todo"}
                    </span>
                    {b.reason && (
                      <span className="text-muted-foreground"> • {b.reason}</span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeBlock(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {profile && <ChangeLogCard representativeId={profile.id} />}
    </div>
  );
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function AvailRow({
  avail,
  onRemove,
  onSave,
  onToggle,
}: {
  avail: Avail;
  onRemove: () => void;
  onSave: (patch: Partial<Avail>) => Promise<boolean>;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [wd, setWd] = useState(avail.weekday);
  const [start, setStart] = useState(avail.start_time.slice(0, 5));
  const [end, setEnd] = useState(avail.end_time.slice(0, 5));
  const [dur, setDur] = useState(avail.meeting_duration_min);

  const reset = () => {
    setWd(avail.weekday);
    setStart(avail.start_time.slice(0, 5));
    setEnd(avail.end_time.slice(0, 5));
    setDur(avail.meeting_duration_min);
  };

  const save = async () => {
    const ok = await onSave({
      weekday: wd,
      start_time: start,
      end_time: end,
      meeting_duration_min: dur,
    });
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={wd}
            onChange={(e) => setWd(parseInt(e.target.value))}
          >
            {WEEKDAYS.map((w, i) => (
              <option key={i} value={i}>
                {w}
              </option>
            ))}
          </select>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          <Input
            type="number"
            value={dur}
            onChange={(e) => setDur(parseInt(e.target.value) || 30)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              reset();
              setEditing(false);
            }}
          >
            <X className="mr-1 h-4 w-4" /> Cancelar
          </Button>
          <Button size="sm" onClick={save}>
            <Check className="mr-1 h-4 w-4" /> Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3">
      <div className="text-sm">
        <span className="font-medium">{WEEKDAYS[avail.weekday]}</span>{" "}
        <span className="text-muted-foreground">
          {avail.start_time.slice(0, 5)} – {avail.end_time.slice(0, 5)} •{" "}
          {avail.meeting_duration_min} min
        </span>
        {!avail.active && (
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            inativo
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onToggle} title={avail.active ? "Desativar" : "Ativar"}>
          {avail.active ? "Desativar" : "Ativar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function CalendarSubscriptionCard({ token }: { token: string | null }) {
  const STORAGE_KEY = "seta:lastIcsSync";
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v ? new Date(v) : null;
  });
  const [refreshing, setRefreshing] = useState(false);

  if (!token) return null;
  const httpsUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/calendar/${token}.ics`;
  const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      toast.success("URL copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const refreshNow = async () => {
    setRefreshing(true);
    try {
      // Cache-bust query param + no-store força o servidor e o app de calendário
      // a buscar o feed atualizado em vez de usar o cache.
      const res = await fetch(`${httpsUrl}?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error(String(res.status));
      await res.text();
      const now = new Date();
      setLastSync(now);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, now.toISOString());
      }
      toast.success("Agenda sincronizada");
    } catch {
      toast.error("Não foi possível atualizar agora");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="h-4 w-4" />
          Sincronizar com seu calendário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Assine este link no Apple Calendar, Outlook ou qualquer app de calendário para ver
          seus agendamentos automaticamente. A agenda atualiza sozinha (a cada ~30 min).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={httpsUrl} onFocus={(e) => e.currentTarget.select()} />
          <Button variant="outline" onClick={copy}>
            <Copy className="mr-1.5 h-4 w-4" />
            Copiar
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={webcalUrl}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Apple className="h-4 w-4" />
            Adicionar ao Apple Calendar
          </a>
          <a
            href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <CalendarPlus className="h-4 w-4" />
            Adicionar ao Google Calendar
          </a>
          <Button variant="outline" onClick={refreshNow} disabled={refreshing}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar agora"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {lastSync
            ? `Última sincronização: ${lastSync.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
            : "Ainda não sincronizado nesta sessão."}
        </p>
        <p className="text-xs text-muted-foreground">
          Mantenha esta URL privada — quem tiver acesso a ela poderá ver seus horários e
          contatos dos clientes.
        </p>
      </CardContent>
    </Card>
  );
}
