import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/view-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Handshake,
  TrendingUp,
  XCircle,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

type NegotiationRow = {
  id: string;
  appointment_date: string;
  start_time: string;
  meeting_type: string;
  meeting_result: string;
  sale_value: string | null;
  budget_code: string | null;
  order_code: string | null;
  result_notes: string | null;
  representative_id: string;
  client_name: string;
  client_company: string | null;
  client_email: string;
  city: string | null;
  state: string | null;
  updated_at: string;
};

type Rep = { id: string; full_name: string };

const ALL = "__all__";

const RESULT_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  em_negociacao: { label: "Em negociação", icon: <Clock className="h-3.5 w-3.5" />, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  venda_fechada: { label: "Venda fechada", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  proposta_reprovada: { label: "Reprovada", icon: <XCircle className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

export function NegotiationsList() {
  const { profile, role } = useAuth();
  const [viewMode] = useViewMode();
  const isAdmin = role === "admin" && viewMode === "admin";

  const [rows, setRows] = useState<NegotiationRow[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [resultFilter, setResultFilter] = useState<string>(ALL);
  const [repFilter, setRepFilter] = useState<string>(ALL);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit dialog
  const [editing, setEditing] = useState<NegotiationRow | null>(null);
  const [editResult, setEditResult] = useState("");
  const [editSaleValue, setEditSaleValue] = useState("");
  const [editBudgetCode, setEditBudgetCode] = useState("");
  const [editOrderCode, setEditOrderCode] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    void supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name")
      .then(({ data }) => setReps((data as Rep[]) ?? []));
  }, [isAdmin]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);

    let q = supabase
      .from("appointments")
      .select(
        "id, appointment_date, start_time, meeting_type, meeting_result, sale_value, budget_code, order_code, result_notes, representative_id, client_id, city, state, updated_at",
      )
      .eq("status", "completed")
      .not("meeting_result", "is", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (!isAdmin) q = q.eq("representative_id", profile.id);
    else if (repFilter !== ALL) q = q.eq("representative_id", repFilter);
    if (resultFilter !== ALL) q = q.eq("meeting_result", resultFilter);

    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data) return;

    const clientIds = [...new Set(data.map((d) => d.client_id))];
    const { data: clients } = clientIds.length
      ? await supabase.from("clients").select("id, name, company, email").in("id", clientIds)
      : { data: [] as { id: string; name: string; company: string | null; email: string }[] };

    const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

    setRows(
      data.map((d) => ({
        id: d.id,
        appointment_date: d.appointment_date,
        start_time: d.start_time,
        meeting_type: d.meeting_type,
        meeting_result: d.meeting_result,
        sale_value: d.sale_value,
        budget_code: d.budget_code,
        order_code: d.order_code,
        result_notes: d.result_notes,
        representative_id: d.representative_id,
        client_name: clientMap.get(d.client_id)?.name ?? "—",
        client_company: clientMap.get(d.client_id)?.company ?? null,
        client_email: clientMap.get(d.client_id)?.email ?? "",
        city: d.city,
        state: d.state,
        updated_at: d.updated_at,
      })),
    );
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, role, resultFilter, repFilter]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        (r.client_company ?? "").toLowerCase().includes(q) ||
        (r.city ?? "").toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const negociando = rows.filter((r) => r.meeting_result === "em_negociacao").length;
    const vendas = rows.filter((r) => r.meeting_result === "venda_fechada").length;
    const reprovadas = rows.filter((r) => r.meeting_result === "proposta_reprovada").length;
    const valorTotal = rows
      .filter((r) => r.meeting_result === "venda_fechada" && r.sale_value)
      .reduce((sum, r) => {
        const val = parseFloat((r.sale_value ?? "0").replace(/[^\d.,]/g, "").replace(",", "."));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
    return { negociando, vendas, reprovadas, valorTotal };
  }, [rows]);

  const repName = useMemo(() => {
    const m = new Map(reps.map((r) => [r.id, r.full_name]));
    return (id: string) => m.get(id) ?? "—";
  }, [reps]);

  const openEdit = (row: NegotiationRow) => {
    setEditing(row);
    setEditResult(row.meeting_result);
    setEditSaleValue(row.sale_value ?? "");
    setEditBudgetCode(row.budget_code ?? "");
    setEditOrderCode(row.order_code ?? "");
    setEditNotes(row.result_notes ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);

    const { error } = await supabase
      .from("appointments")
      .update({
        meeting_result: editResult,
        sale_value: editResult === "venda_fechada" ? editSaleValue.trim() || null : null,
        budget_code: editResult === "venda_fechada" ? editBudgetCode.trim() || null : null,
        order_code: editResult === "venda_fechada" ? editOrderCode.trim() || null : null,
        result_notes: editNotes.trim() || null,
      })
      .eq("id", editing.id);

    setSaving(false);
    if (error) { toast.error(error.message); return; }

    toast.success("Negociação atualizada!");
    setEditing(null);
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Negociações</h1>
        <p className="text-muted-foreground">
          Acompanhe o status das reuniões concluídas e atualize o andamento.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatMini
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          label="Em negociação"
          value={stats.negociando}
        />
        <StatMini
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          label="Vendas fechadas"
          value={stats.vendas}
        />
        <StatMini
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          label="Reprovadas"
          value={stats.reprovadas}
        />
        <StatMini
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          label="Valor total"
          value={`R$ ${stats.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="em_negociacao">Em negociação</SelectItem>
                <SelectItem value="venda_fechada">Venda fechada</SelectItem>
                <SelectItem value="proposta_reprovada">Reprovada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div>
              <Label className="text-xs">Representante</Label>
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cliente, empresa ou cidade…"
            />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-4 w-4 text-primary" />
            {filtered.length} {filtered.length === 1 ? "negociação" : "negociações"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y px-4">
              {Array.from({ length: 5 }).map((_, i) => <ListRowSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma negociação encontrada.
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const meta = RESULT_LABELS[r.meeting_result];
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(r)}
                    onKeyDown={(e) => { if (e.key === "Enter") openEdit(r); }}
                    className="flex cursor-pointer flex-col gap-2 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.client_name}</span>
                        {r.client_company && (
                          <span className="text-sm text-muted-foreground">• {r.client_company}</span>
                        )}
                        {isAdmin && (
                          <Badge variant="outline" className="text-xs">
                            {repName(r.representative_id)}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {format(new Date(r.appointment_date + "T00:00"), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {r.city && <span>• {r.city}{r.state ? ` - ${r.state}` : ""}</span>}
                      </div>
                      {r.result_notes && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {r.result_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {r.sale_value && (
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                          R$ {r.sale_value}
                        </span>
                      )}
                      {meta && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.color}`}>
                          {meta.icon}
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editing && (
        <Dialog open={true} onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Atualizar negociação</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{editing.client_name}</div>
                {editing.client_company && (
                  <div className="text-muted-foreground">{editing.client_company}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  {format(new Date(editing.appointment_date + "T00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  {" • "}{editing.client_email}
                </div>
              </div>

              <div>
                <Label className="text-sm">Status da negociação</Label>
                <Select value={editResult} onValueChange={setEditResult}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_negociacao">🔄 Em negociação</SelectItem>
                    <SelectItem value="venda_fechada">✅ Venda fechada</SelectItem>
                    <SelectItem value="proposta_reprovada">❌ Proposta reprovada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editResult === "venda_fechada" && (
                <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800/40 dark:bg-green-900/20">
                  <div>
                    <Label className="text-xs">Valor da venda (R$)</Label>
                    <Input value={editSaleValue} onChange={(e) => setEditSaleValue(e.target.value)} placeholder="15.000,00" />
                  </div>
                  <div>
                    <Label className="text-xs">Código do orçamento</Label>
                    <Input value={editBudgetCode} onChange={(e) => setEditBudgetCode(e.target.value)} placeholder="ORC-2026-0042" />
                  </div>
                  <div>
                    <Label className="text-xs">Código do pedido</Label>
                    <Input value={editOrderCode} onChange={(e) => setEditOrderCode(e.target.value)} placeholder="PED-2026-0018" />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Observações / Andamento</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Atualize o andamento da negociação…"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StatMini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
        <div>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
