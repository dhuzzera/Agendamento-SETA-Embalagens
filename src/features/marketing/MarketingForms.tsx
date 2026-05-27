import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, FileInput, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

export function MarketingForms() {
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: forms, isLoading, refetch } = useQuery({
    queryKey: ["marketing-forms"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("capture_forms")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const PUBLIC_HOST = typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? window.location.host
    : "sistema.setaembalagens.com.br";

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("capture_forms").update({ active: !active }).eq("id", id);
    void refetch();
  };

  const deleteForm = async (id: string) => {
    if (!confirm("Excluir este formulário?")) return;
    await supabase.from("capture_forms").delete().eq("id", id);
    toast.success("Formulário excluído");
    void refetch();
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`https://${PUBLIC_HOST}/form/${slug}`);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Formulários de captura</h1>
          <p className="text-muted-foreground">Crie landing pages para capturar leads automaticamente.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo formulário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><ListRowSkeleton /><ListRowSkeleton /></div>
          ) : !forms?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum formulário criado.</p>
          ) : (
            <div className="divide-y">
              {forms.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileInput className="h-4 w-4 text-primary" />
                      <span className="font-medium">{f.name}</span>
                      {!f.active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {PUBLIC_HOST}/form/{f.slug} • {f.submissions} submissões
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={f.active} onCheckedChange={() => void toggleActive(f.id, f.active)} />
                    <Button size="sm" variant="outline" onClick={() => copyLink(f.slug)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/form/${f.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void deleteForm(f.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && <CreateFormDialog onClose={() => { setCreateOpen(false); void refetch(); }} />}
    </div>
  );
}

function CreateFormDialog({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [listId, setListId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: lists } = useQuery({
    queryKey: ["marketing-lists-select"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("contact_lists").select("id, name");
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!name.trim() || !slug.trim()) { toast.error("Preencha nome e slug"); return; }
    setBusy(true);
    const { error } = await supabase.from("capture_forms").insert({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      list_id: listId || null,
      created_by: profile?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Formulário criado!");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo formulário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Solicitar orçamento" />
          </div>
          <div>
            <Label className="text-xs">Slug (URL) *</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="ex: solicitar-orcamento"
            />
            <p className="mt-1 text-xs text-muted-foreground">URL: /form/{slug || "..."}</p>
          </div>
          <div>
            <Label className="text-xs">Adicionar leads à lista</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger><SelectValue placeholder="Nenhuma (opcional)" /></SelectTrigger>
              <SelectContent>
                {(lists ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Criando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
