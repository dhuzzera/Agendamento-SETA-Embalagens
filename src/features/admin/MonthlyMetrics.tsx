import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

type Appt = {
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

type Avail = {
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

type DayPoint = { day: string; agendados: number; concluidos: number; cancelados: number; ocupacao: number };

export function MonthlyMetrics() {
  const [byMonth, setByMonth] = useState<
    Array<{ key: string; label: string; data: DayPoint[]; totals: { total: number; concluidos: number; cancelados: number; ocupacaoMedia: number } }>
  >([]);

  useEffect(() => {
    const load = async () => {
      // Limita a janela a 6 meses para evitar varredura completa da tabela.
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      const sinceStr = since.toISOString().slice(0, 10);
      const [{ data: appts }, { data: avails }] = await Promise.all([
        supabase
          .from("appointments")
          .select("appointment_date, start_time, end_time, status")
          .gte("appointment_date", sinceStr)
          .order("appointment_date", { ascending: true }),
        supabase
          .from("availabilities")
          .select("weekday, start_time, end_time, active")
          .eq("active", true),
      ]);

      const list = (appts ?? []) as Appt[];
      const av = ((avails ?? []) as Avail[]).filter((a) => a.active);

      // Capacity per weekday in minutes (sum across all reps active availability)
      const capByWeekday = new Map<number, number>();
      for (const a of av) {
        const mins = minutesBetween(a.start_time, a.end_time);
        capByWeekday.set(a.weekday, (capByWeekday.get(a.weekday) ?? 0) + mins);
      }

      // Group appointments by month → by day
      const groups = new Map<string, Map<string, DayPoint>>();
      for (const a of list) {
        const monthKey = a.appointment_date.slice(0, 7); // YYYY-MM
        if (!groups.has(monthKey)) groups.set(monthKey, new Map());
        const days = groups.get(monthKey)!;
        const day = a.appointment_date;
        if (!days.has(day)) {
          days.set(day, { day, agendados: 0, concluidos: 0, cancelados: 0, ocupacao: 0 });
        }
        const p = days.get(day)!;
        if (a.status === "scheduled" || a.status === "rescheduled") p.agendados += 1;
        if (a.status === "completed") p.concluidos += 1;
        if (a.status === "cancelled") p.cancelados += 1;
      }

      const months = Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, days]) => {
          // Calc ocupação by day: booked minutes / capacity for that weekday
          const dayList = Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day));
          for (const p of dayList) {
            const date = parseISO(p.day);
            const wd = date.getDay();
            const cap = capByWeekday.get(wd) ?? 0;
            const booked = list
              .filter((a) => a.appointment_date === p.day && a.status !== "cancelled")
              .reduce((sum, a) => sum + minutesBetween(a.start_time, a.end_time), 0);
            p.ocupacao = cap > 0 ? Math.round((booked / cap) * 100) : 0;
          }

          const total = dayList.reduce((s, d) => s + d.agendados + d.concluidos + d.cancelados, 0);
          const concluidos = dayList.reduce((s, d) => s + d.concluidos, 0);
          const cancelados = dayList.reduce((s, d) => s + d.cancelados, 0);
          const occVals = dayList.filter((d) => d.ocupacao > 0).map((d) => d.ocupacao);
          const ocupacaoMedia =
            occVals.length > 0
              ? Math.round(occVals.reduce((s, v) => s + v, 0) / occVals.length)
              : 0;

          return {
            key,
            label: format(startOfMonth(parseISO(`${key}-01`)), "MMMM 'de' yyyy", {
              locale: ptBR,
            }),
            data: dayList,
            totals: { total, concluidos, cancelados, ocupacaoMedia },
          };
        });

      // Most recent first
      setByMonth(months.reverse());
    };
    void load();
  }, []);

  if (byMonth.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métricas mensais</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sem dados ainda. Os gráficos aparecem aqui à medida que os agendamentos forem criados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Métricas mensais</h2>
        <p className="text-sm text-muted-foreground">
          Um gráfico para cada mês com agendamentos e taxa de ocupação.
        </p>
      </div>
      {byMonth.map((m) => (
        <MonthCard key={m.key} label={m.label} data={m.data} totals={m.totals} />
      ))}
    </div>
  );
}

function MonthCard({
  label,
  data,
  totals,
}: {
  label: string;
  data: DayPoint[];
  totals: { total: number; concluidos: number; cancelados: number; ocupacaoMedia: number };
}) {
  const chartData = data.map((d) => ({
    ...d,
    dia: d.day.slice(8, 10),
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <CardTitle className="capitalize">{label}</CardTitle>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Stat label="Total" value={totals.total} />
            <Stat label="Concluídos" value={totals.concluidos} />
            <Stat label="Cancelados" value={totals.cancelados} />
            <Stat label="Ocupação média" value={`${totals.ocupacaoMedia}%`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Agendamentos por dia
          </p>
          <ChartContainer
            className="h-[220px] w-full"
            config={{
              agendados: { label: "Agendados", color: "hsl(var(--primary))" },
              concluidos: { label: "Concluídos", color: "hsl(var(--chart-2, 142 70% 45%))" },
              cancelados: { label: "Cancelados", color: "hsl(var(--destructive))" },
            }}
          >
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="agendados" stackId="a" fill="var(--color-agendados)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="concluidos" stackId="a" fill="var(--color-concluidos)" />
              <Bar dataKey="cancelados" stackId="a" fill="var(--color-cancelados)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Taxa de ocupação diária (%)
          </p>
          <ChartContainer
            className="h-[180px] w-full"
            config={{
              ocupacao: { label: "Ocupação", color: "hsl(var(--primary))" },
            }}
          >
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="ocupacao"
                stroke="var(--color-ocupacao)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-secondary px-2.5 py-1">
      <span className="font-semibold text-foreground">{value}</span>{" "}
      <span>{label}</span>
    </div>
  );
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}
