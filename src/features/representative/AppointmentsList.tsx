import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { X, Download, CalendarDays } from "lucide-react";
// Dialog pesado (edição/admin) — só baixa quando o usuário abrir um agendamento.
const AppointmentDetailsDialog = lazy(() =>
  import("@/features/admin/AppointmentDetailsDialog").then((m) => ({
    default: m.AppointmentDetailsDialog,
  })),
);
import { ListRowSkeleton } from "@/components/Skeletons";

type Status = "scheduled" | "completed" | "cancelled" | "rescheduled";

type Row = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: Status;
  notes: string | null;
  meeting_type: "online" | "presencial";
  location: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  representative_id: string;
  client: { name: string; company: string | null; email: string; phone: string | null };
};

type Rep = { id: string; full_name: string };

const ALL = "__all__";

export function AppointmentsList() {
  const { profile, role } = useAuth();
  const [viewMode] = useViewMode();
  // Apenas admin (e no modo admin) pode filtrar/ver outros representantes.
  const isAdmin = role === "admin" && viewMode === "admin";

  const [rows, setRows] = useState<Row[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [repFilter, setRepFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<string>(ALL);
  const [addressQuery, setAddressQuery] = useState<string>("");
  const [cityQuery, setCityQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "date_desc" | "date_asc" | "meeting_type" | "location"
  >("date_desc");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Calendar
  const [calMonth, setCalMonth] = useState<Date>(startOfMonth(new Date()));
  const [monthDates, setMonthDates] = useState<Date[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    void supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name")
      .then(({ data }) => setReps((data as Rep[]) ?? []));
  }, [isAdmin]);

  // Carrega as datas do mês visível para destacar dias com reuniões
  useEffect(() => {
    if (!profile) return;
    const start = format(startOfMonth(calMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(calMonth), "yyyy-MM-dd");
    let q = supabase
      .from("appointments")
      .select("appointment_date, status")
      .gte("appointment_date", start)
      .lte("appointment_date", end)
      .neq("status", "cancelled");
    if (!isAdmin) q = q.eq("representative_id", profile.id);
    else if (repFilter !== ALL) q = q.eq("representative_id", repFilter);
    setMonthLoading(true);
    void q.then(({ data }) => {
      setMonthLoading(false);
      const set = new Set((data ?? []).map((d) => d.appointment_date as string));
      setMonthDates([...set].map((s) => parseISO(s)));
    });
  }, [profile, isAdmin, repFilter, calMonth]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    let q = supabase
      .from("appointments")
      .select(
        "id, appointment_date, start_time, end_time, status, notes, meeting_type, location, city, state, client_id, representative_id"
      )
      .order("appointment_date", { ascending: false })
      .order("start_time")
      .limit(200);

    if (!isAdmin) q = q.eq("representative_id", profile.id);
    else if (repFilter !== ALL) q = q.eq("representative_id", repFilter);

    if (statusFilter !== ALL) q = q.eq("status", statusFilter as Status);
    if (meetingTypeFilter !== ALL) q = q.eq("meeting_type", meetingTypeFilter);
    if (addressQuery.trim()) q = q.ilike("location", `%${addressQuery.trim()}%`);
    if (cityQuery.trim()) q = q.ilike("city", `%${cityQuery.trim()}%`);
    if (from) q = q.gte("appointment_date", from);
    if (to) q = q.lte("appointment_date", to);

    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) return;
    const ids = [...new Set(data.map((d) => d.client_id))];
    const { data: clis } = ids.length
      ? await supabase
          .from("clients")
          .select("id, name, company, email, phone")
          .in("id", ids)
      : { data: [] as { id: string; name: string; company: string | null; email: string; phone: string | null }[] };
    const map = new Map(clis?.map((c) => [c.id, c]));
    setRows(
      data.map((d) => ({
        ...(d as Omit<Row, "client">),
        client: (map.get(d.client_id) as Row["client"]) ?? {
          name: "—",
          company: null,
          email: "",
          phone: null,
        },
      }))
    );
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, role, repFilter, statusFilter, meetingTypeFilter, addressQuery, cityQuery, from, to]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      if (sortBy === "date_asc" || sortBy === "date_desc") {
        const cmp =
          a.appointment_date.localeCompare(b.appointment_date) ||
          a.start_time.localeCompare(b.start_time);
        return sortBy === "date_asc" ? cmp : -cmp;
      }
      if (sortBy === "meeting_type") {
        return (
          a.meeting_type.localeCompare(b.meeting_type) ||
          b.appointment_date.localeCompare(a.appointment_date)
        );
      }
      // location: presencial first ordered by address, online last
      const al = a.location?.toLowerCase() ?? "";
      const bl = b.location?.toLowerCase() ?? "";
      if (!al && bl) return 1;
      if (al && !bl) return -1;
      return al.localeCompare(bl) || b.appointment_date.localeCompare(a.appointment_date);
    });
    return arr;
  }, [rows, sortBy]);

  const cancel = async (id: string) => {
    if (!confirm("Cancelar este agendamento?")) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Agendamento cancelado");
      void load();
    }
  };

  const repName = useMemo(() => {
    const m = new Map(reps.map((r) => [r.id, r.full_name]));
    return (id: string) => m.get(id) ?? "—";
  }, [reps]);

  const setPeriod = (kind: "today" | "week" | "month" | "all") => {
    const now = new Date();
    if (kind === "today") {
      const d = format(now, "yyyy-MM-dd");
      setFrom(d);
      setTo(d);
    } else if (kind === "week") {
      setFrom(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setTo(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (kind === "month") {
      setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
      setTo(format(endOfMonth(now), "yyyy-MM-dd"));
    } else {
      setFrom("");
      setTo("");
    }
  };

  const clearFilters = () => {
    setRepFilter(ALL);
    setStatusFilter(ALL);
    setMeetingTypeFilter(ALL);
    setAddressQuery("");
    setCityQuery("");
    setFrom("");
    setTo("");
  };

  const hasFilters =
    repFilter !== ALL ||
    statusFilter !== ALL ||
    meetingTypeFilter !== ALL ||
    !!addressQuery ||
    !!cityQuery ||
    !!from ||
    !!to;

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.info("Nenhum agendamento para exportar.");
      return;
    }
    const headers = [
      "Data",
      "Início",
      "Fim",
      "Status",
      "Representante",
      "Cliente",
      "Empresa",
      "E-mail",
      "Telefone",
      "Observações",
    ];
    const esc = (v: string | null | undefined) => {
      const s = (v ?? "").toString().replace(/"/g, '""');
      return /[",;\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [
      headers.join(";"),
      ...rows.map((r) =>
        [
          format(new Date(r.appointment_date + "T00:00"), "dd/MM/yyyy"),
          r.start_time.slice(0, 5),
          r.end_time.slice(0, 5),
          labelStatus(r.status),
          repName(r.representative_id),
          r.client.name,
          r.client.company,
          r.client.email,
          r.client.phone,
          r.notes,
        ]
          .map(esc)
          .join(";")
      ),
    ];
    // BOM for Excel UTF-8 detection
    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agendamentos_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} agendamento(s) exportado(s)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isAdmin ? "Agendamentos" : "Minhas reuniões"}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Visão consolidada de todas as agendas dos representantes."
              : "Histórico e próximas reuniões."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={exportCsv} variant="outline">
            <Download className="mr-1.5 h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Calendário do mês com dias que possuem reuniões destacados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Calendário do mês
            {monthLoading && (
              <span className="text-xs font-normal text-muted-foreground">
                carregando…
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
              dias com reuniões
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 lg:flex-row lg:items-start lg:justify-between">
          <Calendar
            mode="single"
            locale={ptBR}
            month={calMonth}
            onMonthChange={setCalMonth}
            selected={from && to && from === to ? parseISO(from) : undefined}
            onSelect={(d) => {
              if (!d) {
                setFrom("");
                setTo("");
                return;
              }
              const s = format(d, "yyyy-MM-dd");
              setFrom(s);
              setTo(s);
            }}
            modifiers={{ hasMeeting: monthDates }}
            modifiersClassNames={{
              hasMeeting:
                "relative font-semibold text-primary after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
            }}
            className="pointer-events-auto rounded-md border bg-card p-3"
          />

          <div className="flex-1 space-y-3 text-sm lg:max-w-xs">
            <p className="font-medium">
              {from && to && from === to
                ? `Reuniões em ${format(parseISO(from), "dd 'de' MMMM", { locale: ptBR })}`
                : "Selecione um dia"}
            </p>
            {from && to && from === to ? (
              (() => {
                const dayRows = rows.filter((r) =>
                  isSameDay(parseISO(r.appointment_date), parseISO(from)),
                );
                if (dayRows.length === 0) {
                  return (
                    <p className="text-muted-foreground">
                      Nenhuma reunião neste dia.
                    </p>
                  );
                }
                return (
                  <ul className="space-y-2">
                    {dayRows.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between rounded-md border p-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {r.client.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                          </div>
                        </div>
                        <Badge
                          variant={
                            r.status === "scheduled"
                              ? "default"
                              : r.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {labelStatus(r.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                );
              })()
            ) : (
              <p className="text-muted-foreground">
                Clique em uma data para filtrar a lista abaixo. Os dias com
                ponto azul possuem reuniões agendadas.
              </p>
            )}
            {from && to && from === to && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Limpar dia
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isAdmin && (
              <div>
                <Label className="text-xs">Representante</Label>
                <Select value={repFilter} onValueChange={setRepFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {reps.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="rescheduled">Remarcado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Modalidade</Label>
              <Select value={meetingTypeFilter} onValueChange={setMeetingTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="Ex.: Joinville"
              />
            </div>
            <div>
              <Label className="text-xs">Endereço contém</Label>
              <Input
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                placeholder="Ex.: Av. Paulista"
              />
            </div>
            <div>
              <Label className="text-xs">Ordenar por</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Data (mais recente)</SelectItem>
                  <SelectItem value="date_asc">Data (mais antiga)</SelectItem>
                  <SelectItem value="meeting_type">Modalidade</SelectItem>
                  <SelectItem value="location">Endereço</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPeriod("today")}>
              Hoje
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPeriod("week")}>
              Esta semana
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPeriod("month")}>
              Este mês
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPeriod("all")}>
              Todo o período
            </Button>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters} className="ml-auto">
                <X className="mr-1 h-3.5 w-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Lista de agendamentos
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({rows.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y px-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ListRowSkeleton key={i} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma reunião encontrada com os filtros atuais.
            </p>
          ) : (
            <div className="divide-y">
              {sortedRows.map((r) => (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelected(r);
                    setDialogOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(r);
                      setDialogOpen(true);
                    }
                  }}
                  className="flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.client.name}</span>
                      {r.client.company && (
                        <span className="text-sm text-muted-foreground">
                          • {r.client.company}
                        </span>
                      )}
                      {isAdmin && (
                        <Badge variant="outline" className="text-xs">
                          {repName(r.representative_id)}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {r.client.email} {r.client.phone && `• ${r.client.phone}`}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={r.meeting_type === "presencial" ? "default" : "secondary"}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {r.meeting_type === "presencial" ? "Presencial" : "Online"}
                      </Badge>
                      {r.meeting_type === "presencial" && (r.city || r.location) && (
                        <span className="text-xs text-muted-foreground">
                          📍 {r.city ? `${r.city}${r.state ? ` - ${r.state.toUpperCase()}` : ""}` : ""}
                          {r.city && r.location ? " • " : ""}
                          {r.location ?? ""}
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {format(new Date(r.appointment_date + "T00:00"), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        r.status === "scheduled"
                          ? "default"
                          : r.status === "cancelled"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {labelStatus(r.status)}
                    </Badge>
                    {r.status === "scheduled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void cancel(r.id);
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <Suspense fallback={null}>
          <AppointmentDetailsDialog
            appointment={selected}
            representativeName={selected ? repName(selected.representative_id) : ""}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onChanged={load}
          />
        </Suspense>
      )}
    </div>
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
