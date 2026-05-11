import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type Row = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  notes: string | null;
  client: { name: string; company: string | null; email: string; phone: string | null };
};

export function AppointmentsList() {
  const { profile, role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    if (!profile) return;
    let q = supabase
      .from("appointments")
      .select("id, appointment_date, start_time, end_time, status, notes, client_id")
      .order("appointment_date", { ascending: false })
      .order("start_time");
    if (role !== "admin") q = q.eq("representative_id", profile.id);
    const { data } = await q;
    if (!data) return;
    const ids = [...new Set(data.map((d) => d.client_id))];
    const { data: clis } = await supabase
      .from("clients")
      .select("id, name, company, email, phone")
      .in("id", ids);
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
  }, [profile, role]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Minhas reuniões</h1>
        <p className="text-muted-foreground">Histórico e próximas reuniões.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de agendamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma reunião.</p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.client.name}</span>
                      {r.client.company && (
                        <span className="text-sm text-muted-foreground">
                          • {r.client.company}
                        </span>
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
