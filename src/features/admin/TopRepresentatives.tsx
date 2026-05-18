import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Trophy } from "lucide-react";

type RepStat = {
  name: string;
  total: number;
  concluidos: number;
  cancelados: number;
};

export function TopRepresentatives() {
  const { data: repStats } = useQuery({
    queryKey: ["admin-dashboard", "top-reps"],
    staleTime: 60_000,
    queryFn: async () => {
      const mStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const mEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data: appts } = await supabase
        .from("appointments")
        .select("representative_id, status")
        .gte("appointment_date", mStart)
        .lte("appointment_date", mEnd);

      if (!appts?.length) return [];

      const repIds = [...new Set(appts.map((a) => a.representative_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", repIds);

      const nameMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);

      const statsMap = new Map<string, RepStat>();
      for (const a of appts) {
        const name = nameMap.get(a.representative_id) ?? "—";
        const cur = statsMap.get(a.representative_id) ?? { name, total: 0, concluidos: 0, cancelados: 0 };
        cur.total += 1;
        if (a.status === "completed") cur.concluidos += 1;
        if (a.status === "cancelled") cur.cancelados += 1;
        statsMap.set(a.representative_id, cur);
      }

      return [...statsMap.values()]
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
  });

  if (!repStats || repStats.length === 0) return null;

  const chartConfig = {
    total: { label: "Total", color: "hsl(var(--primary))" },
    concluidos: { label: "Concluídos", color: "hsl(142, 71%, 45%)" },
    cancelados: { label: "Cancelados", color: "hsl(0, 84%, 60%)" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-primary" />
          Representantes mais ativos (mês atual)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart
            data={repStats}
            layout="vertical"
            margin={{ left: 0, right: 16, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>

        {/* Ranking textual */}
        <div className="mt-4 divide-y">
          {repStats.slice(0, 5).map((r, i) => (
            <div key={r.name} className="flex items-center justify-between py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span className="font-medium">{r.name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{r.total} agendamentos</span>
                <span className="text-green-600">{r.concluidos} concluídos</span>
                {r.cancelados > 0 && <span className="text-red-500">{r.cancelados} cancelados</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
