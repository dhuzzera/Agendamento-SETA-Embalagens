import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Settings,
  Monitor,
  MapPin,
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
    <Card className="overflow-hidden border-primary/20">
      {/* Faixa de destaque */}
      <div
        className="flex items-start gap-3 px-6 py-4 text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/30">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">
            Tenha sua agenda no celular em 2 minutos
          </h3>
          <p className="mt-0.5 text-sm text-primary-foreground/85">
            Receba os agendamentos automaticamente no seu app de calendário.
          </p>
        </div>
      </div>

      <CardContent className="space-y-5 pt-5">
        {/* Passo 1 — escolha o app */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              1
            </span>
            Escolha onde você quer ver sua agenda
          </div>

          <Tabs defaultValue="iphone" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="iphone" className="gap-1.5">
                <Apple className="h-3.5 w-3.5" />
                iPhone
              </TabsTrigger>
              <TabsTrigger value="android" className="gap-1.5">
                <Smartphone className="h-3.5 w-3.5" />
                Android
              </TabsTrigger>
              <TabsTrigger value="outlook" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Outlook
              </TabsTrigger>
            </TabsList>

            {/* iPhone / Apple */}
            <TabsContent value="iphone" className="mt-4 space-y-3">
              <a
                href={webcalUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary-hover sm:w-auto"
              >
                <Apple className="h-4 w-4" />
                Adicionar ao Apple Calendar
                <ExternalLink className="ml-0.5 h-3.5 w-3.5 opacity-70" />
              </a>
              <ol className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">1.</span> Toque
                  no botão azul acima no seu iPhone.
                </li>
                <li>
                  <span className="font-medium text-foreground">2.</span> O
                  iPhone vai perguntar “Adicionar calendário?” — toque em{" "}
                  <span className="font-medium text-foreground">
                    Adicionar
                  </span>
                  .
                </li>
                <li>
                  <span className="font-medium text-foreground">3.</span> Pronto!
                  Seus agendamentos aparecerão no app Calendário.
                </li>
              </ol>
            </TabsContent>

            {/* Android / Google */}
            <TabsContent value="android" className="mt-4 space-y-3">
              <a
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary-hover sm:w-auto"
              >
                <CalendarPlus className="h-4 w-4" />
                Adicionar ao Google Calendar
                <ExternalLink className="ml-0.5 h-3.5 w-3.5 opacity-70" />
              </a>
              <ol className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">1.</span> Faça
                  isso pelo computador (mais rápido) com sua conta Google
                  logada.
                </li>
                <li>
                  <span className="font-medium text-foreground">2.</span>{" "}
                  Confirme em{" "}
                  <span className="font-medium text-foreground">Adicionar</span>
                  .
                </li>
                <li>
                  <span className="font-medium text-foreground">3.</span> No
                  celular Android, abra o app Google Agenda — a agenda SETA
                  aparece junto.
                </li>
              </ol>
            </TabsContent>

            {/* Outlook */}
            <TabsContent value="outlook" className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={httpsUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" onClick={copy}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copiar URL
                </Button>
              </div>
              <ol className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">1.</span> No
                  Outlook, abra{" "}
                  <span className="font-medium text-foreground">
                    Calendário → Adicionar calendário → Inscrever-se na web
                  </span>
                  .
                </li>
                <li>
                  <span className="font-medium text-foreground">2.</span> Cole
                  a URL acima e dê um nome (ex.: “Agenda SETA”).
                </li>
                <li>
                  <span className="font-medium text-foreground">3.</span>{" "}
                  Clique em{" "}
                  <span className="font-medium text-foreground">
                    Importar
                  </span>{" "}
                  e pronto.
                </li>
              </ol>
            </TabsContent>
          </Tabs>
        </div>

        {/* Passo 2 — atualizar agora */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              2
            </span>
            Quando criar um novo horário, atualize a sincronização
          </div>
          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              A agenda atualiza sozinha a cada ~30 minutos. Para ver na hora,
              clique em “Atualizar agora”.
            </p>
            <Button onClick={refreshNow} disabled={refreshing}>
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Atualizando…" : "Atualizar agora"}
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            {lastSync
              ? `Última sincronização: ${lastSync.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
              : "Ainda não sincronizado nesta sessão."}
          </p>
        </div>

        {/* Aviso de privacidade */}
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground/80">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Mantenha esta URL privada — quem tiver acesso a ela poderá ver
            seus horários e contatos dos clientes.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
