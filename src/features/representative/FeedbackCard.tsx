import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FeedbackCard() {
  const { profile } = useAuth();

  const { data } = useQuery({
    queryKey: ["feedback-summary", profile?.id],
    enabled: !!profile?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

      const { data: appts } = await supabase
        .from("appointments")
        .select("feedback_rating, appointment_date, client_id")
        .eq("representative_id", profile!.id)
        .not("feedback_rating", "is", null)
        .gte("appointment_date", thirtyDaysAgo)
        .order("appointment_date", { ascending: false })
        .limit(50);

      if (!appts?.length) return { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0], recent: [] };

      const ratings = appts.map((a) => a.feedback_rating as number);
      const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
      const distribution = [0, 0, 0, 0, 0];
      for (const r of ratings) distribution[r - 1]++;

      // Get client names for recent feedback
      const recentAppts = appts.slice(0, 5);
      const clientIds = [...new Set(recentAppts.map((a) => a.client_id))];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));

      const recent = recentAppts.map((a) => ({
        rating: a.feedback_rating as number,
        date: a.appointment_date,
        client: clientMap.get(a.client_id) ?? "—",
      }));

      return { avg, count: ratings.length, distribution, recent };
    },
  });

  if (!data || data.count === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-yellow-500" />
          Avaliações dos clientes
          <span className="text-xs font-normal text-muted-foreground">
            (últimos 30 dias)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground">
              {data.avg.toFixed(1)}
            </div>
            <div className="flex items-center justify-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-3.5 w-3.5 ${
                    s <= Math.round(data.avg)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.count} {data.count === 1 ? "avaliação" : "avaliações"}
            </div>
          </div>

          {/* Distribution bars */}
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = data.distribution[star - 1];
              const pct = data.count > 0 ? (count / data.count) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-right text-muted-foreground">
                    {star}
                  </span>
                  <Star className="h-3 w-3 text-yellow-400" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-yellow-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-5 text-right text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent feedback */}
        {data.recent.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Últimas avaliações
            </p>
            <ul className="divide-y">
              {data.recent.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3 w-3 ${
                            s <= f.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-foreground">{f.client}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(f.date + "T00:00"), "dd/MM", {
                      locale: ptBR,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
