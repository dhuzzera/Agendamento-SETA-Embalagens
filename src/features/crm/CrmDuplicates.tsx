import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Merge, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

type DuplicateGroup = {
  key: string;
  items: {
    id: string;
    title: string;
    client_name: string | null;
    client_email: string | null;
    company: string | null;
    value: number | null;
    created_at: string;
    pipeline_name: string | null;
    stage_name: string | null;
  }[];
};

export function CrmDuplicates() {
  const [mode, setMode] = useState<"deals" | "contacts">("deals");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: duplicates, isLoading, refetch } = useQuery({
    queryKey: ["crm-duplicates", mode],
    staleTime: 30_000,
    queryFn: async () => {
      if (mode === "deals") {
        // Find deals with same title (potential duplicates)
        const { data: deals } = await supabase
          .from("deals")
          .select("id, title, client_id, value, created_at, stage_id, pipeline_id")
          .order("title")
          .order("created_at");

        if (!deals?.length) return [];

        // Enrich
        const clientIds = [...new Set(deals.map((d) => d.client_id).filter(Boolean))] as string[];
        const stageIds = [...new Set(deals.map((d) => d.stage_id))];
        const pipelineIds = [...new Set(deals.map((d) => d.pipeline_id).filter(Boolean))] as string[];

        const [{ data: clients }, { data: stages }, { data: pipelines }] = await Promise.all([
          clientIds.length ? supabase.from("clients").select("id, name, email, company").in("id", clientIds) : { data: [] as { id: string; name: string; email: string; company: string | null }[] },
          supabase.from("deal_stages").select("id, name").in("id", stageIds),
          pipelineIds.length ? supabase.from("pipelines").select("id, name").in("id", pipelineIds) : { data: [] as { id: string; name: string }[] },
        ]);

        const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
        const stageMap = new Map((stages ?? []).map((s) => [s.id, s.name]));
        const pipelineMap = new Map((pipelines ?? []).map((p) => [p.id, p.name]));

        // Group by normalized title
        const groups = new Map<string, DuplicateGroup["items"]>();
        for (const d of deals) {
          const key = d.title.trim().toLowerCase();
          const client = d.client_id ? clientMap.get(d.client_id) : null;
          const item = {
            id: d.id,
            title: d.title,
            client_name: client?.name ?? null,
            client_email: client?.email ?? null,
            company: client?.company ?? null,
            value: d.value,
            created_at: d.created_at,
            pipeline_name: d.pipeline_id ? pipelineMap.get(d.pipeline_id) ?? null : null,
            stage_name: stageMap.get(d.stage_id) ?? null,
          };
          const arr = groups.get(key);
          if (arr) arr.push(item);
          else groups.set(key, [item]);
        }

        // Only return groups with 2+ items (actual duplicates)
        return [...groups.entries()]
          .filter(([, items]) => items.length > 1)
          .map(([key, items]) => ({ key, items }));
      } else {
        // Find contacts with same email or same name
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name, email, phone, company, created_at")
          .order("name");

        if (!clients?.length) return [];

        const groups = new Map<string, DuplicateGroup["items"]>();
        for (const c of clients) {
          // Group by email (primary) or name if no email
          const key = c.email && !c.email.includes("@importado.local")
            ? c.email.trim().toLowerCase()
            : c.name.trim().toLowerCase();
          const item = {
            id: c.id,
            title: c.name,
            client_name: c.name,
            client_email: c.email,
            company: c.company,
            value: null,
            created_at: c.created_at,
            pipeline_name: null,
            stage_name: null,
          };
          const arr = groups.get(key);
          if (arr) arr.push(item);
          else groups.set(key, [item]);
        }

        return [...groups.entries()]
          .filter(([, items]) => items.length > 1)
          .map(([key, items]) => ({ key, items }));
      }
    },
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInGroup = (group: DuplicateGroup, keepFirst = true) => {
    setSelected((prev) => {
      const next = new Set(prev);
      group.items.forEach((item, i) => {
        if (keepFirst && i === 0) next.delete(item.id); // keep the first
        else next.add(item.id);
      });
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} registro(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);

    const ids = [...selected];

    if (mode === "deals") {
      // Delete activities first
      await supabase.from("deal_activities").delete().in("deal_id", ids);
      const { error } = await supabase.from("deals").delete().in("id", ids);
      if (error) { toast.error(error.message); setBusy(false); return; }
    } else {
      const { error } = await supabase.from("clients").delete().in("id", ids);
      if (error) { toast.error(error.message); setBusy(false); return; }
    }

    toast.success(`${ids.length} registro(s) excluído(s)`);
    setSelected(new Set());
    setBusy(false);
    void refetch();
  };

  const mergeGroup = async (group: DuplicateGroup) => {
    if (group.items.length < 2) return;
    setBusy(true);

    // Keep the first item (oldest), delete the rest
    const keep = group.items[0];
    const toDelete = group.items.slice(1).map((i) => i.id);

    if (mode === "deals") {
      // Move activities from duplicates to the kept deal
      for (const id of toDelete) {
        await supabase.from("deal_activities").update({ deal_id: keep.id }).eq("deal_id", id);
      }
      await supabase.from("deals").delete().in("id", toDelete);
    } else {
      // Move deals from duplicate clients to the kept client
      for (const id of toDelete) {
        await supabase.from("deals").update({ client_id: keep.id }).eq("client_id", id);
      }
      await supabase.from("clients").delete().in("id", toDelete);
    }

    toast.success(`Mesclado: manteve "${keep.title}", removeu ${toDelete.length} duplicata(s)`);
    setBusy(false);
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar duplicados</h1>
          <p className="text-muted-foreground">
            Encontre e resolva registros duplicados no CRM.
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" onClick={deleteSelected} disabled={busy}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Excluir {selected.size} selecionado(s)
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={mode} onValueChange={(v) => { setMode(v as typeof mode); setSelected(new Set()); }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deals">Negociações duplicadas</SelectItem>
            <SelectItem value="contacts">Contatos duplicados</SelectItem>
          </SelectContent>
        </Select>
        {duplicates && (
          <span className="text-sm text-muted-foreground">
            {duplicates.length} {duplicates.length === 1 ? "grupo" : "grupos"} de duplicados encontrados
          </span>
        )}
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4"><ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton /></CardContent></Card>
      ) : !duplicates?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum duplicado encontrado. Tudo limpo!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {duplicates.map((group) => (
            <Card key={group.key}>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  {group.items.length} registros com nome "{group.items[0].title}"
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectAllInGroup(group)}
                    disabled={busy}
                  >
                    Selecionar duplicados
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void mergeGroup(group)}
                    disabled={busy}
                  >
                    <Merge className="mr-1.5 h-3.5 w-3.5" />
                    Mesclar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {group.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          {idx === 0 && (
                            <Badge variant="secondary" className="text-[10px]">Original</Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {item.client_email && <span>{item.client_email}</span>}
                          {item.company && <span>• {item.company}</span>}
                          {item.pipeline_name && <span>• {item.pipeline_name}</span>}
                          {item.stage_name && <span>• {item.stage_name}</span>}
                          {item.value != null && item.value > 0 && (
                            <span className="font-medium text-green-600">
                              R$ {item.value.toLocaleString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
