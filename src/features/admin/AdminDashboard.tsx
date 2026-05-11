import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Shield, TrendingUp } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { lazy, Suspense } from "react";
import {
  PageHeaderSkeleton,
  StatCardsRowSkeleton,
  ListCardSkeleton,
  ChartSkeleton,
} from "@/components/Skeletons";
const MonthlyMetrics = lazy(() =>
  import("./MonthlyMetrics").then((m) => ({ default: m.MonthlyMetrics })),
);

type Counts = {
  reps: number;
  admins: number;
  today: number;
  week: number;
  month: number;
};

type Upcoming = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  rep_name: string;
  client_name: string;
};

export function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);

  useEffect(() => {
    const load = async () => {
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

      setCounts({
        reps: roles?.filter((r) => r.role === "representative").length ?? 0,
        admins: roles?.filter((r) => r.role === "admin").length ?? 0,
        today: tdC ?? 0,
        week: wkC ?? 0,
        month: mC ?? 0,
      });

      const { data: appts } = await supabase
        .from("appointments")
        .select(
          "id, appointment_date, start_time, end_time, status, representative_id, client_id"
        )
        .gte("appointment_date", today)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(10);

      if (appts && appts.length) {
        const repIds = [...new Set(appts.map((a) => a.representative_id))];
        const cliIds = [...new Set(appts.map((a) => a.client_id))];
        const [{ data: reps }, { data: clis }] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", repIds),
          supabase.from("clients").select("id, name").in("id", cliIds),
        ]);
        const repMap = new Map(reps?.map((r) => [r.id, r.full_name]));
        const cliMap = new Map(clis?.map((c) => [c.id, c.name]));
        setUpcoming(
          appts.map((a) => ({
            id: a.id,
            appointment_date: a.appointment_date,
            start_time: a.start_time,
            end_time: a.end_time,
            status: a.status,
            rep_name: repMap.get(a.representative_id) ?? "—",
            client_name: cliMap.get(a.client_id) ?? "—",
          }))
        );
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Painel administrativo</h1>
        <p className="text-muted-foreground">Visão geral da operação comercial Seta.</p>
      </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard to="/admin/usuarios" icon={<Users />} label="Representantes" value={counts?.reps ?? 0} />
        <StatCard to="/admin/usuarios" icon={<Shield />} label="Administradores" value={counts?.admins ?? 0} />
        <StatCard to="/agenda" icon={<Calendar />} label="Hoje" value={counts?.today ?? 0} />
        <StatCard to="/agenda" icon={<TrendingUp />} label="Esta semana" value={counts?.week ?? 0} />
        <StatCard to="/agenda" icon={<TrendingUp />} label="Este mês" value={counts?.month ?? 0} />
      </div>

    <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Próximos agendamentos</CardTitle>
          <Link to="/agenda" className="text-sm font-medium text-primary hover:underline">
            Ver todos →
          </Link>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
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

      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/50" />}>
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
