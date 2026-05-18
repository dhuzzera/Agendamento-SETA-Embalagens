import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { CalendarDays } from "lucide-react";

type ApptRow = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  meeting_type: string;
  representative_id: string;
  client_id: string;
};

export function UnifiedCalendar() {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const { data: appointments } = useQuery({
    queryKey: ["unified-calendar", format(month, "yyyy-MM")],
    staleTime: 60_000,
    queryFn: async () => {
      const start = format(startOfMonth(month), "yyyy-MM-dd");
      const end = format(endOfMonth(month), "yyyy-MM-dd");
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, end_time, status, meeting_type, representative_id, client_id")
        .gte("appointment_date", start)
        .lte("appointment_date", end)
        .neq("status", "cancelled")
        .order("start_time");
      return (data ?? []) as ApptRow[];
    },
  });

  const { data: reps } = useQuery({
    queryKey: ["unified-calendar", "reps"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["unified-calendar", "clients", format(month, "yyyy-MM")],
    enabled: !!appointments?.length,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = [...new Set((appointments ?? []).map((a) => a.client_id))];
      if (ids.length === 0) return [];
      const { data } = await supabase.from("clients").select("id, name").in("id", ids);
      return data ?? [];
    },
  });

  const repMap = new Map((reps ?? []).map((r) => [r.id, r.full_name]));
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const datesWithAppts = [...new Set((appointments ?? []).map((a) => a.appointment_date))].map((d) => parseISO(d));

  const selectedAppts = selectedDate
    ? (appointments ?? []).filter((a) => isSameDay(parseISO(a.appointment_date), selectedDate))
    : [];

  // Agrupa por representante
  const groupedByRep = new Map<string, ApptRow[]>();
  for (const a of selectedAppts) {
    const list = groupedByRep.get(a.representative_id) ?? [];
    list.push(a);
    groupedByRep.set(a.representative_id, list);
  }

  const repColors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          Agenda unificada — todos os representantes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <Calendar
            mode="single"
            locale={ptBR}
            month={month}
            onMonthChange={setMonth}
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={{ hasAppt: datesWithAppts }}
            modifiersClassNames={{
              hasAppt: "relative font-semibold text-primary after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
            }}
            className="rounded-md border p-3"
          />

          <div className="min-h-[200px]">
            {!selectedDate ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Selecione um dia para ver os agendamentos de todos os representantes.
              </div>
            ) : selectedAppts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum agendamento em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}.
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold capitalize">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  <span className="ml-2 font-normal text-muted-foreground">
                    ({selectedAppts.length} {selectedAppts.length === 1 ? "reunião" : "reuniões"})
                  </span>
                </h3>
                {[...groupedByRep.entries()].map(([repId, appts], idx) => (
                  <div key={repId} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${repColors[idx % repColors.length]}`} />
                      <span className="text-sm font-medium">{repMap.get(repId) ?? "—"}</span>
                      <Badge variant="outline" className="text-[10px]">{appts.length}</Badge>
                    </div>
                    <div className="ml-5 space-y-1">
                      {appts.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                          <div>
                            <span className="font-medium">{clientMap.get(a.client_id) ?? "—"}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {a.meeting_type === "presencial" ? "📍" : "💻"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
