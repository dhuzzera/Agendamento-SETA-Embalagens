import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Shield, TrendingUp, MapPin, Settings, FileText } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  StatCardsRowSkeleton,
  ListCardSkeleton,
  ChartSkeleton,
} from "@/components/Skeletons";
import { generatePdfReport } from "@/lib/export-pdf";
const MonthlyMetrics = lazy(() =>
  import("./MonthlyMetrics").then((m) => ({ default: m.MonthlyMetrics })),
);
const TopRepresentatives = lazy(() =>
  import("./TopRepresentatives").then((m) => ({ default: m.TopRepresentatives })),
);
const UnifiedCalendar = lazy(() =>
  import("./UnifiedCalendar").then((m) => ({ default: m.UnifiedCalendar })),
);
const SalesDashboard = lazy(() =>
  import("./SalesDashboard").then((m) => ({ default: m.SalesDashboard })),
);

export function AdminDashboard() {
  const { data: counts } = useQuery({
    queryKey: ["admin-dashboard", "counts"],
    staleTime: 60_000,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const wkStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const wkEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const mStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const mEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const [{ data: roles }, { count: tdC }, { count: wkC }, { count: mC }] =
        await Promise.all([
          supabase.from("user_roles").select("role"),
          supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("appointment_date", today),
          supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .gte("appointment_date", wkStart)
            .lte("appointment_date", wkEnd),
          supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .gte("appointment_date", mStart)
            .lte("appointment_date", mEnd),
        ]);

      return {
        reps: roles?.filter((r) => r.role === "representative").length ?? 0,
        admins: roles?.filter((r) => r.role === "admin").length ?? 0,
        today: tdC ?? 0,
        week: wkC ?? 0,
        month: mC ?? 0,
      };
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["admin-dashboard", "upcoming"],
    staleTime: 60_000,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: appts } = await supabase
        .from("appointments")
        .select(
          "id, appointment_date, start_time, end_time, status, representative_id, client_id",
        )
        .gte("appointment_date", today)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(10);

      if (!appts?.length) return [];
      const repIds = [...new Set(appts.map((a) => a.representative_id))];
      const cliIds = [...new Set(appts.map((a) => a.client_id))];
      const [{ data: reps }, { data: clis }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", repIds),
        supabase.from("clients").select("id, name").in("id", cliIds),
      ]);
      const repMap = new Map(reps?.map((r) => [r.id, r.full_name]));
      const cliMap = new Map(clis?.map((c) => [c.id, c.name]));
      return appts.map((a) => ({
        id: a.id,
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        end_time: a.end_time,
        status: a.status,
        rep_name: repMap.get(a.representative_id) ?? "—",
        client_name: cliMap.get(a.client_id) ?? "—",
      }));
    },
  });

  // Próximos dias com região definida (presenciais agrupados por rep + data + cidade)
  const { data: regionAgenda } = useQuery({
    queryKey: ["admin-dashboard", "region-agenda"],
    staleTime: 60_000,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const horizon = format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd");
      const { data: appts } = await supabase
        .from("appointments")
        .select("appointment_date, start_time, city, state, representative_id, status, meeting_type")
        .eq("meeting_type", "presencial")
        .in("status", ["scheduled", "rescheduled"])
        .gte("appointment_date", today)
        .lte("appointment_date", horizon)
        .order("appointment_date")
        .order("start_time");
      if (!appts?.length) return [];
      const repIds = [...new Set(appts.map((a) => a.representative_id))];
      const { data: reps } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", repIds);
      const repMap = new Map(reps?.map((r) => [r.id, r.full_name]));
      const map = new Map<string, { date: string; rep: string; city: string; state: string; count: number }>();
      for (const a of appts) {
        if (!a.city || !a.state) continue;
        const key = `${a.representative_id}_${a.appointment_date}`;
        const cur = map.get(key);
        if (!cur) {
          map.set(key, {
            date: a.appointment_date,
            rep: repMap.get(a.representative_id) ?? "—",
            city: a.city,
            state: a.state,
            count: 1,
          });
        } else cur.count += 1;
      }
      return [...map.values()];
    },
  });

  // Travel buffer setting
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["app-settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("travel_buffer_minutes, max_distance_km")
        .eq("id", 1)
        .maybeSingle();
      return data ?? { travel_buffer_minutes: 180, max_distance_km: 30 };
    },
  });
  const [bufferInput, setBufferInput] = useState<string>("");
  const [distanceInput, setDistanceInput] = useState<string>("");
  useEffect(() => {
    if (settings && bufferInput === "") {
      setBufferInput(String(settings.travel_buffer_minutes ?? 180));
    }
    if (settings && distanceInput === "") {
      setDistanceInput(String((settings as { max_distance_km?: number }).max_distance_km ?? 30));
    }
  }, [settings, bufferInput, distanceInput]);
  const saveBuffer = async () => {
    const n = parseInt(bufferInput, 10);
    const d = parseInt(distanceInput, 10);
    if (Number.isNaN(n) || n < 0 || n > 720) {
      toast.error("Tempo: informe um valor entre 0 e 720 minutos");
      return;
    }
    if (Number.isNaN(d) || d < 1 || d > 500) {
      toast.error("Raio: informe um valor entre 1 e 500 km");
      return;
    }
    const { error } = await supabase
      .from("app_settings")
      .update({ travel_buffer_minutes: n, max_distance_km: d })
      .eq("id", 1);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Configurações atualizadas");
      void queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Painel administrativo</h1>
          <p className="text-muted-foreground">Visão geral da operação comercial SETA.</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            const mStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
            const mEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
            const { data: appts } = await supabase
              .from("appointments")
              .select("appointment_date, start_time, end_time, status, meeting_type, representative_id, client_id")
              .gte("appointment_date", mStart)
              .lte("appointment_date", mEnd)
              .order("appointment_date")
              .order("start_time");
            if (!appts?.length) { toast.info("Nenhum agendamento no mês para exportar."); return; }
            const repIds = [...new Set(appts.map((a) => a.representative_id))];
            const cliIds = [...new Set(appts.map((a) => a.client_id))];
            const [{ data: reps }, { data: clis }] = await Promise.all([
              supabase.from("profiles").select("id, full_name").in("id", repIds),
              supabase.from("clients").select("id, name").in("id", cliIds),
            ]);
            const repMap = new Map(reps?.map((r) => [r.id, r.full_name]) ?? []);
            const cliMap = new Map(clis?.map((c) => [c.id, c.name]) ?? []);
            const statusLabel: Record<string, string> = { scheduled: "Agendado", completed: "Concluído", cancelled: "Cancelado", rescheduled: "Remarcado" };
            const repCounts = new Map<string, number>();
            for (const a of appts) { repCounts.set(a.representative_id, (repCounts.get(a.representative_id) ?? 0) + 1); }
            const topReps = [...repCounts.entries()]
              .map(([id, total]) => ({ name: repMap.get(id) ?? "—", total }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 5);
            generatePdfReport({
              title: "Relatório Mensal — SETA Embalagens",
              period: format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }),
              stats: [
                { label: "Total de agendamentos", value: appts.length },
                { label: "Concluídos", value: appts.filter((a) => a.status === "completed").length },
                { label: "Cancelados", value: appts.filter((a) => a.status === "cancelled").length },
                { label: "Representantes ativos", value: repIds.length },
              ],
              topReps,
              appointments: appts.map((a) => ({
                date: a.appointment_date.split("-").reverse().join("/"),
                time: a.start_time.slice(0, 5) + " – " + a.end_time.slice(0, 5),
                client: cliMap.get(a.client_id) ?? "—",
                representative: repMap.get(a.representative_id) ?? "—",
                type: a.meeting_type === "presencial" ? "Presencial" : "Online",
                status: statusLabel[a.status] ?? a.status,
              })),
            });
          }}
        >
          <FileText className="mr-1.5 h-4 w-4" />
          Relatório PDF
        </Button>
      </div>

      {counts ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard to="/admin/usuarios" icon={<Users />} label="Representantes" value={counts.reps} />
          <StatCard to="/admin/usuarios" icon={<Shield />} label="Administradores" value={counts.admins} />
          <StatCard to="/agenda" icon={<Calendar />} label="Hoje" value={counts.today} />
          <StatCard to="/agenda" icon={<TrendingUp />} label="Esta semana" value={counts.week} />
          <StatCard to="/agenda" icon={<TrendingUp />} label="Este mês" value={counts.month} />
        </div>
      ) : (
        <StatCardsRowSkeleton count={5} />
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Próximos agendamentos</CardTitle>
          <Link to="/agenda" className="text-sm font-medium text-primary hover:underline">
            Ver todos →
          </Link>
        </CardHeader>
        <CardContent>
          {upcoming === undefined ? (
            <ListCardSkeleton title={false} rows={4} />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento futuro.</p>
          ) : (
            <div className="divide-y">
              {upcoming.map((a) => (
                <Link
                  key={a.id}
                  to="/agenda"
                  className="-mx-6 flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium">{a.client_name}</div>
                    <div className="text-sm text-muted-foreground">com {a.rep_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {format(new Date(a.appointment_date + "T00:00"), "dd/MM", {
                        locale: ptBR,
                      })}{" "}
                      • {a.start_time.slice(0, 5)}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {labelStatus(a.status)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-primary" />
            Configurações de deslocamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="text-xs">Tempo de deslocamento entre visitas presenciais (minutos)</Label>
              <Input
                type="number"
                min={0}
                max={720}
                value={bufferInput}
                onChange={(e) => setBufferInput(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Bloqueia este intervalo antes/depois de cada visita. Padrão: 180 min (3h).
              </p>
            </div>
            <div className="flex-1">
              <Label className="text-xs">Raio máximo entre visitas no mesmo dia (km)</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A primeira visita do dia define a região; as demais devem estar dentro desse raio. Padrão: 30 km.
              </p>
            </div>
            <Button onClick={saveBuffer}>Salvar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Agenda por cidade (próximos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!regionAgenda ? (
            <ListCardSkeleton title={false} rows={3} />
          ) : regionAgenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma visita presencial agendada.</p>
          ) : (
            <ul className="divide-y">
              {regionAgenda.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">
                      {format(new Date(r.date + "T00:00"), "EEE, dd/MM", { locale: ptBR })}
                    </div>
                    <span className="text-muted-foreground">{r.rep}</span>
                    <Badge variant="secondary" className="text-xs">
                      {r.city} - {r.state.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.count} {r.count === 1 ? "visita" : "visitas"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Suspense fallback={<ChartSkeleton height={256} />}>
        <SalesDashboard />
      </Suspense>

      <Suspense fallback={<ChartSkeleton height={256} />}>
        <UnifiedCalendar />
      </Suspense>

      <Suspense fallback={<ChartSkeleton height={256} />}>
        <TopRepresentatives />
      </Suspense>

      <Suspense fallback={<ChartSkeleton height={256} />}>
        <MonthlyMetrics />
      </Suspense>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to: "/admin/usuarios" | "/agenda" | "/disponibilidade" | "/dashboard";
}) {
  return (
    <Link to={to} className="block">
      <Card className="transition-all hover:border-primary/40 hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function labelStatus(s: string) {
  return (
    { scheduled: "Agendado", completed: "Concluído", cancelled: "Cancelado", rescheduled: "Remarcado" } as Record<string, string>
  )[s] ?? s;
}
