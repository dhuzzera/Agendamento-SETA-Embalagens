import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type AvailSnap = {
  weekday?: number;
  start_time?: string;
  end_time?: string;
  meeting_duration_min?: number;
  active?: boolean;
} | null;

type Change = {
  id: string;
  action: "created" | "updated" | "deleted";
  old_values: AvailSnap;
  new_values: AvailSnap;
  affected_appointment_ids: string[];
  created_at: string;
};

type ApptInfo = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name: string;
};

export function ChangeLogCard({ representativeId }: { representativeId: string }) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [appts, setAppts] = useState<Map<string, ApptInfo>>(new Map());
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("availability_changes")
        .select("id, action, old_values, new_values, affected_appointment_ids, created_at")
        .eq("representative_id", representativeId)
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (data ?? []) as Change[];
      setChanges(list);

      const allIds = [...new Set(list.flatMap((c) => c.affected_appointment_ids))];
      if (allIds.length) {
        const { data: ap } = await supabase
          .from("appointments")
          .select("id, appointment_date, start_time, end_time, status, client_id")
          .in("id", allIds);
        const cliIds = [...new Set((ap ?? []).map((a) => a.client_id))];
        const { data: cli } = cliIds.length
          ? await supabase.from("clients").select("id, name").in("id", cliIds)
          : { data: [] as Array<{ id: string; name: string }> };
        const cliMap = new Map((cli ?? []).map((c) => [c.id, c.name]));
        const m = new Map<string, ApptInfo>();
        (ap ?? []).forEach((a) =>
          m.set(a.id, {
            id: a.id,
            appointment_date: a.appointment_date,
            start_time: a.start_time,
            end_time: a.end_time,
            status: a.status,
            client_name: cliMap.get(a.client_id) ?? "Cliente",
          }),
        );
        setAppts(m);
      }
    };
    void load();
  }, [representativeId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Histórico de alterações
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Registro das mudanças nos seus horários e quais agendamentos confirmados
          foram afetados em cada uma.
        </p>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {changes.map((c) => {
              const isOpen = !!open[c.id];
              return (
                <div key={c.id} className="text-sm">
                  <button
                    type="button"
                    onClick={() => setOpen((s) => ({ ...s, [c.id]: !isOpen }))}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Badge variant={c.action === "deleted" ? "destructive" : "outline"}>
                        {labelAction(c.action)}
                      </Badge>
                      <span className="font-medium">{summarize(c)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {c.affected_appointment_ids.length > 0 && (
                        <Badge variant="secondary">
                          {c.affected_appointment_ids.length} afetado(s)
                        </Badge>
                      )}
                      <span>
                        {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t bg-muted/20 px-4 py-3 text-xs">
                      {c.action === "updated" && (
                        <div>
                          <span className="text-muted-foreground">De: </span>
                          {describe(c.old_values)}
                          <span className="text-muted-foreground"> → para: </span>
                          {describe(c.new_values)}
                        </div>
                      )}
                      {c.affected_appointment_ids.length === 0 ? (
                        <p className="text-muted-foreground">
                          Nenhum agendamento confirmado foi afetado.
                        </p>
                      ) : (
                        <div>
                          <p className="mb-1 font-medium">Agendamentos afetados:</p>
                          <ul className="space-y-1">
                            {c.affected_appointment_ids.map((id) => {
                              const a = appts.get(id);
                              if (!a)
                                return (
                                  <li key={id} className="text-muted-foreground">
                                    {id.slice(0, 8)}…
                                  </li>
                                );
                              return (
                                <li key={id}>
                                  <span className="font-medium">{a.client_name}</span> —{" "}
                                  {formatDate(a.appointment_date)} •{" "}
                                  {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}{" "}
                                  <Badge variant="outline" className="ml-1">
                                    {a.status}
                                  </Badge>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function labelAction(a: Change["action"]) {
  return { created: "Criado", updated: "Editado", deleted: "Excluído" }[a];
}

function summarize(c: Change) {
  if (c.action === "created") return describe(c.new_values);
  if (c.action === "deleted") return describe(c.old_values);
  return describe(c.new_values);
}

function describe(s: AvailSnap) {
  if (!s) return "—";
  const wd = s.weekday !== undefined ? WEEKDAYS[s.weekday] : "?";
  const st = s.start_time?.slice(0, 5) ?? "?";
  const et = s.end_time?.slice(0, 5) ?? "?";
  const dur = s.meeting_duration_min ?? "?";
  const active = s.active === false ? " (inativo)" : "";
  return `${wd} ${st}–${et}, ${dur}min${active}`;
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
