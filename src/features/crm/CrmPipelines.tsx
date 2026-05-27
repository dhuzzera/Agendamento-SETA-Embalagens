import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

type Pipeline = {
  id: string;
  name: string;
  position: number;
  owner_id: string | null;
  owner_name?: string;
  stage_count?: number;
};

type Stage = {
  id: string;
  name: string;
  position: number;
  color: string;
  pipeline_id: string;
};

export function CrmPipelines() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editPipeline, setEditPipeline] = useState<Pipeline | null>(null);
  const [stagesOpen, setStagesOpen] = useState<Pipeline | null>(null);

  const { data: pipelines, isLoading, refetch } = useQuery({
    queryKey: ["crm-pipelines-admin"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id, name, position, owner_id")
        .order("position");

      if (!data?.length) return [];

      const ownerIds = [...new Set(data.map((p) => p.owner_id).filter(Boolean))] as string[];
      const { data: owners } = ownerIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ownerIds)
        : { data: [] as { id: string; full_name: string }[] };
      const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.full_name]));

      // Count stages per pipeline
      const { data: stages } = await supabase.from("deal_stages").select("pipeline_id");
      const stageCount = new Map<string, number>();
      for (const s of stages ?? []) {
        if (s.pipeline_id) stageCount.set(s.pipeline_id, (stageCount.get(s.pipeline_id) ?? 0) + 1);
      }

      return data.map((p) => ({
        ...p,
        owner_name: p.owner_id ? ownerMap.get(p.owner_id) : undefined,
        stage_count: stageCount.get(p.id) ?? 0,
      })) as Pipeline[];
    },
  });

  const deletePipeline = async (p: Pipeline) => {
    if (!confirm(`Excluir o funil "${p.name}"? Negociações e estágios vinculados serão desvinculados.`)) return;
    // Remove stages first
    await supabase.from("deal_stages").delete().eq("pipeline_id", p.id);
    // Unlink deals
    await supabase.from("deals").update({ pipeline_id: null }).eq("pipeline_id", p.id);
    const { error } = await supabase.from("pipelines").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Funil excluído");
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configurar funis</h1>
          <p className="text-muted-foreground">Gerencie os pipelines e seus estágios.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo funil
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton /></div>
          ) : !pipelines?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum funil cadastrado.</p>
          ) : (
            <div className="divide-y">
              {pipelines.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="secondary" className="text-xs">{p.stage_count} estágios</Badge>
                    </div>
                    {p.owner_name && (
                      <p className="text-xs text-muted-foreground">Responsável: {p.owner_name}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStagesOpen(p)}>
                      <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                      Estágios
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditPipeline(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void deletePipeline(p)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && <PipelineDialog onClose={() => { setCreateOpen(false); void refetch(); }} />}
      {editPipeline && <PipelineDialog pipeline={editPipeline} onClose={() => { setEditPipeline(null); void refetch(); }} />}
      {stagesOpen && <StagesDialog pipeline={stagesOpen} onClose={() => { setStagesOpen(null); void refetch(); }} />}
    </div>
  );
}

function PipelineDialog({ pipeline, onClose }: { pipeline?: Pipeline; onClose: () => void }) {
  const [name, setName] = useState(pipeline?.name ?? "");
  const [ownerId, setOwnerId] = useState(pipeline?.owner_id ?? "");
  const [busy, setBusy] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["all-users"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  const submit = async () => {
    if (!name.trim()) { toast.error("Informe o nome do funil"); return; }
    setBusy(true);

    if (pipeline) {
      const { error } = await supabase.from("pipelines").update({
        name: name.trim(),
        owner_id: ownerId || null,
      }).eq("id", pipeline.id);
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Funil atualizado");
    } else {
      // Get next position
      const { data: existing } = await supabase.from("pipelines").select("position").order("position", { ascending: false }).limit(1);
      const nextPos = (existing?.[0]?.position ?? -1) + 1;

      const { error } = await supabase.from("pipelines").insert({
        name: name.trim(),
        position: nextPos,
        owner_id: ownerId || null,
      });
      if (error) { toast.error(error.message); setBusy(false); return; }

      // Create default stages for the new pipeline
      const { data: newPipeline } = await supabase.from("pipelines").select("id").eq("name", name.trim()).maybeSingle();
      if (newPipeline) {
        await supabase.from("deal_stages").insert([
          { name: "Qualificados", position: 0, color: "#6366f1", pipeline_id: newPipeline.id },
          { name: "Em Contato", position: 1, color: "#8b5cf6", pipeline_id: newPipeline.id },
          { name: "Reunião Agendada", position: 2, color: "#0ea5e9", pipeline_id: newPipeline.id },
          { name: "Negociação", position: 3, color: "#f97316", pipeline_id: newPipeline.id },
          { name: "Fechados", position: 4, color: "#22c55e", pipeline_id: newPipeline.id },
          { name: "Perdidos", position: 5, color: "#ef4444", pipeline_id: newPipeline.id },
        ]);
      }

      toast.success("Funil criado com estágios padrão");
    }

    setBusy(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pipeline ? "Editar funil" : "Novo funil"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do funil *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: SDR Interno - João" />
          </div>
          <div>
            <Label className="text-xs">Responsável (opcional)</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Nenhum (todos veem)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum (admin only)</SelectItem>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Se definir um responsável, só ele e os admins verão este funil.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StagesDialog({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [busy, setBusy] = useState(false);

  // Load stages
  useState(() => {
    void supabase
      .from("deal_stages")
      .select("id, name, position, color, pipeline_id")
      .eq("pipeline_id", pipeline.id)
      .order("position")
      .then(({ data }) => setStages((data ?? []) as Stage[]));
  });

  const addStage = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const nextPos = stages.length;
    const { data, error } = await supabase.from("deal_stages").insert({
      name: newName.trim(),
      position: nextPos,
      color: newColor,
      pipeline_id: pipeline.id,
    }).select("id, name, position, color, pipeline_id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data) setStages([...stages, data as Stage]);
    setNewName("");
    toast.success("Estágio adicionado");
  };

  const deleteStage = async (stage: Stage) => {
    if (!confirm(`Excluir o estágio "${stage.name}"?`)) return;
    const { error } = await supabase.from("deal_stages").delete().eq("id", stage.id);
    if (error) { toast.error(error.message); return; }
    setStages(stages.filter((s) => s.id !== stage.id));
    toast.success("Estágio excluído");
  };

  const renameStage = async (stage: Stage, newName: string) => {
    if (!newName.trim()) return;
    await supabase.from("deal_stages").update({ name: newName.trim() }).eq("id", stage.id);
    setStages(stages.map((s) => s.id === stage.id ? { ...s, name: newName.trim() } : s));
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estágios — {pipeline.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
              <Input
                defaultValue={s.name}
                onBlur={(e) => void renameStage(s, e.target.value)}
                className="flex-1 h-8 text-sm"
              />
              <Button size="sm" variant="ghost" onClick={() => void deleteStage(s)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}

          <div className="flex items-center gap-2 border-t pt-3">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border"
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Novo estágio…"
              className="flex-1 h-8 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") void addStage(); }}
            />
            <Button size="sm" onClick={addStage} disabled={busy || !newName.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
