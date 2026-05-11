import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Activity } from "lucide-react";

type Row = {
  route: string;
  metric_name: string;
  value: number;
  rating: string | null;
  created_at: string;
};

type Aggregated = {
  route: string;
  metric: string;
  count: number;
  p50: number;
  p75: number;
  p95: number;
  goodPct: number;
};

const METRICS = ["LCP", "INP", "CLS", "FCP", "TTFB", "TTI"] as const;
const WINDOWS = [
  { label: "Última hora", hours: 1 },
  { label: "Últimas 24h", hours: 24 },
  { label: "Últimos 7 dias", hours: 24 * 7 },
];

// Limites Web Vitals oficiais (em ms exceto CLS).
const THRESHOLDS: Record<string, { good: number; poor: number; unit: string }> = {
  LCP: { good: 2500, poor: 4000, unit: "ms" },
  INP: { good: 200, poor: 500, unit: "ms" },
  CLS: { good: 0.1, poor: 0.25, unit: "" },
  FCP: { good: 1800, poor: 3000, unit: "ms" },
  TTFB: { good: 800, poor: 1800, unit: "ms" },
  TTI: { good: 1500, poor: 3500, unit: "ms" },
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function formatValue(metric: string, value: number) {
  const t = THRESHOLDS[metric];
  if (!t) return value.toFixed(2);
  if (t.unit === "ms") return `${Math.round(value)} ms`;
  return value.toFixed(3);
}

function ratingFor(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  const t = THRESHOLDS[metric];
  if (!t) return "needs-improvement";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

function ratingBadge(r: "good" | "needs-improvement" | "poor") {
  const map = {
    good: { label: "Bom", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    "needs-improvement": { label: "Atenção", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    poor: { label: "Ruim", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  } as const;
  const x = map[r];
  return <Badge variant="secondary" className={x.className}>{x.label}</Badge>;
}

export function PerformanceDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [metricFilter, setMetricFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data, error } = await supabase
      .from("performance_metrics")
      .select("route, metric_name, value, rating, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hours]);

  const aggregated: Aggregated[] = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      if (metricFilter !== "all" && r.metric_name !== metricFilter) continue;
      const key = `${r.route}|${r.metric_name}`;
      const arr = groups.get(key) ?? [];
      arr.push(r.value);
      groups.set(key, arr);
    }
    const result: Aggregated[] = [];
    for (const [key, values] of groups) {
      const [route, metric] = key.split("|");
      const sorted = [...values].sort((a, b) => a - b);
      const good = sorted.filter((v) => ratingFor(metric, v) === "good").length;
      result.push({
        route,
        metric,
        count: sorted.length,
        p50: percentile(sorted, 50),
        p75: percentile(sorted, 75),
        p95: percentile(sorted, 95),
        goodPct: (good / sorted.length) * 100,
      });
    }
    return result.sort((a, b) =>
      a.route === b.route
        ? a.metric.localeCompare(b.metric)
        : a.route.localeCompare(b.route)
    );
  }, [rows, metricFilter]);

  const overall = useMemo(() => {
    const byMetric = new Map<string, number[]>();
    for (const r of rows) {
      const arr = byMetric.get(r.metric_name) ?? [];
      arr.push(r.value);
      byMetric.set(r.metric_name, arr);
    }
    return METRICS.map((m) => {
      const vals = byMetric.get(m) ?? [];
      const sorted = [...vals].sort((a, b) => a - b);
      const p75 = percentile(sorted, 75);
      return { metric: m, samples: vals.length, p75, rating: vals.length ? ratingFor(m, p75) : null };
    });
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Activity className="h-6 w-6 text-primary" />
            Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            Web Vitals coletados dos visitantes em tempo real, agrupados por rota.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.hours} value={String(w.hours)}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={metricFilter} onValueChange={setMetricFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas métricas</SelectItem>
              {METRICS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Atualizar">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {overall.map((o) => (
          <Card key={o.metric}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                {o.metric}
                {o.rating && ratingBadge(o.rating)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {o.samples ? formatValue(o.metric, o.p75) : "—"}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                p75 · {o.samples} amostras
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Métricas por rota</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {aggregated.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {loading ? "Carregando…" : "Nenhuma métrica coletada nesse período ainda."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rota</TableHead>
                  <TableHead>Métrica</TableHead>
                  <TableHead className="text-right">Amostras</TableHead>
                  <TableHead className="text-right">p50</TableHead>
                  <TableHead className="text-right">p75</TableHead>
                  <TableHead className="text-right">p95</TableHead>
                  <TableHead className="text-right">% Bom</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map((a) => {
                  const r = ratingFor(a.metric, a.p75);
                  return (
                    <TableRow key={`${a.route}-${a.metric}`}>
                      <TableCell className="font-mono text-xs">{a.route}</TableCell>
                      <TableCell className="font-medium">{a.metric}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatValue(a.metric, a.p50)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatValue(a.metric, a.p75)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatValue(a.metric, a.p95)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.goodPct.toFixed(0)}%</TableCell>
                      <TableCell>{ratingBadge(r)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
