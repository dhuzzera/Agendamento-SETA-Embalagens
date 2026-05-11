import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { X, Download } from "lucide-react";
import { AppointmentDetailsDialog } from "@/features/admin/AppointmentDetailsDialog";

type Status = "scheduled" | "completed" | "cancelled" | "rescheduled";

type Row = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: Status;
  notes: string | null;
  representative_id: string;
  client: { name: string; company: string | null; email: string; phone: string | null };
};

type Rep = { id: string; full_name: string };

const ALL = "__all__";

export function AppointmentsList() {
  const { profile, role } = useAuth();
  const isAdmin = role === "admin";

  const [rows, setRows] = useState<Row[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [repFilter, setRepFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  useEffect(() => {
    if (!isAdmin) return;
    void supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name")
      .then(({ data }) => setReps((data as Rep[]) ?? []));
  }, [isAdmin]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    let q = supabase
      .from("appointments")
      .select(
        "id, appointment_date, start_time, end_time, status, notes, client_id, representative_id"
      )
      .order("appointment_date", { ascending: false })
      .order("start_time");

    if (!isAdmin) q = q.eq("representative_id", profile.id);
    else if (repFilter !== ALL) q = q.eq("representative_id", repFilter);

    if (statusFilter !== ALL) q = q.eq("status", statusFilter as Status);
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
  }, [profile, role, repFilter, statusFilter, from, to]);

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
    setFrom("");
    setTo("");
  };

  const hasFilters =
    repFilter !== ALL || statusFilter !== ALL || !!from || !!to;

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
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma reunião encontrada com os filtros atuais.
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
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
                      <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>
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
