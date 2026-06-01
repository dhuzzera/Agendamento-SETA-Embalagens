import { useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Mail, Phone, Building2, Calendar,
  Handshake, Star, MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CrmClientPage() {
  const { id } = useParams({ from: "/_app/crm/cliente/$id" });
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["crm-client", id],
    queryFn: async () => {
      const [{ data: client }, { data: appointments }, { data: deals }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase
          .from("appointments")
          .select("id, appointment_date, start_time, end_time, status, meeting_type, representative_id, notes, meeting_result, sale_value, feedback_rating")
          .eq("client_id", id)
          .order("appointment_date", { ascending: false }),
        supabase
          .from("deals")
          .select("id, title, stage_id, value, pipeline_id, created_at")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
      ]);

      // Enrich reps
      const repIds = [...new Set((appointments ?? []).map((a) => a.representative_id))];
      const { data: reps } = repIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", repIds)
        : { data: [] as { id: string; full_name: string }[] };
      const repMap = new Map((reps ?? []).map((r) => [r.id, r.full_name]));

      // Enrich stages
      const stageIds = [...new Set((deals ?? []).map((d) => d.stage_id))];
      const { data: stages } = stageIds.length
        ? await supabase.from("deal_stages").select("id, name, color").in("id", stageIds)
        : { data: [] as { id: string; name: string; color: string }[] };
      const stageMap = new Map((stages ?? []).map((s) => [s.id, s]));

      const pipelineIds = [...new Set((deals ?? []).map((d) => d.pipeline_id).filter(Boolean))] as string[];
      const { data: pipelines } = pipelineIds.length
        ? await supabase.from("pipelines").select("id, name").in("id", pipelineIds)
        : { data: [] as { id: string; name: string }[] };
      const pipelineMap = new Map((pipelines ?? []).map((p) => [p.id, p.name]));

      return {
        client,
        appointments: (appointments ?? []).map((a) => ({
          ...a,
          rep_name: repMap.get(a.representative_id) ?? "—",
        })),
        deals: (deals ?? []).map((d) => ({
          ...d,
          stage: stageMap.get(d.stage_id),
          pipeline_name: d.pipeline_id ? pipelineMap.get(d.pipeline_id) : null,
        })),
      };
    },
  });

  if (!data?.client) return <p className="p-8 text-center text-muted-foreground">Carregando…</p>;

  const { client, appointments, deals } = data;
  const statusLabel: Record<string, string> = { scheduled: "Agendado", completed: "Concluído", cancelled: "Cancelado", rescheduled: "Remarcado" };
  const resultLabel: Record<string, string> = { venda_fechada: "Venda fechada", em_negociacao: "Em negociação", proposta_reprovada: "Reprovada" };
  const avgRating = appointments.filter((a) => a.feedback_rating).length > 0
    ? (appointments.filter((a) => a.feedback_rating).reduce((s, a) => s + (a.feedback_rating as number), 0) / appointments.filter((a) => a.feedback_rating).length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => navigate({ to: "/crm" })} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            {client.company && <p className="text-muted-foreground">{client.company}</p>}
          </div>
          {avgRating && (
            <div className="flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 dark:bg-yellow-900/30">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-bold">{avgRating}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <h3 className="font-semibold">Informações</h3>
              {client.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.company && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{client.company}</span>
                </div>
              )}
              <div className="border-t pt-2 text-xs text-muted-foreground">
                Cliente desde {format(new Date(client.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-sm">
              <h3 className="mb-3 font-semibold">Resumo</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reuniões</span>
                  <span className="font-medium">{appointments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Concluídas</span>
                  <span className="font-medium text-green-600">{appointments.filter((a) => a.status === "completed").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Negociações</span>
                  <span className="font-medium">{deals.length}</span>
                </div>
                {client.lead_score > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead score</span>
                    <span className="font-bold text-primary">{client.lead_score} pts</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main */}
        <div className="space-y-6">
          {/* Deals */}
          {deals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Handshake className="h-4 w-4 text-primary" />
                  Negociações ({deals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {deals.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.pipeline_name} • {format(new Date(d.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.value != null && d.value > 0 && (
                          <span className="text-sm font-semibold text-green-600">
                            R$ {Number(d.value).toLocaleString("pt-BR")}
                          </span>
                        )}
                        {d.stage && (
                          <Badge variant="secondary" className="text-xs" style={{ backgroundColor: d.stage.color + "22", color: d.stage.color }}>
                            {d.stage.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appointments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" />
                Histórico de reuniões ({appointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {appointments.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhuma reunião registrada.</p>
              ) : (
                <div className="divide-y">
                  {appointments.map((a) => (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {format(new Date(a.appointment_date + "T00:00"), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}
                            </span>
                            <Badge variant={a.meeting_type === "presencial" ? "default" : "secondary"} className="text-[10px]">
                              {a.meeting_type === "presencial" ? "Presencial" : "Online"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Representante: {a.rep_name}</p>
                          {a.notes && <p className="mt-1 text-xs text-muted-foreground italic">{a.notes}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={a.status === "completed" ? "secondary" : a.status === "cancelled" ? "destructive" : "default"} className="text-[10px]">
                            {statusLabel[a.status] ?? a.status}
                          </Badge>
                          {a.meeting_result && (
                            <span className="text-[10px] text-muted-foreground">{resultLabel[a.meeting_result] ?? a.meeting_result}</span>
                          )}
                          {a.feedback_rating && (
                            <span className="text-[10px] text-yellow-500">{"⭐".repeat(a.feedback_rating as number)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
