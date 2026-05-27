import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

export function MarketingLists() {
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: lists, isLoading, refetch } = useQuery({
    queryKey: ["marketing-lists"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_lists")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: false });

      if (!data?.length) return [];

      // Count members per list
      const { data: members } = await supabase.from("contact_list_members").select("list_id");
      const countMap = new Map<string, number>();
      for (const m of members ?? []) {
        countMap.set(m.list_id, (countMap.get(m.list_id) ?? 0) + 1);
      }

      return data.map((l) => ({ ...l, member_count: countMap.get(l.id) ?? 0 }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Listas de contatos</h1>
          <p className="text-muted-foreground">Segmente seus contatos em listas para campanhas direcionadas.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova lista
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><ListRowSkeleton /><ListRowSkeleton /></div>
          ) : !lists?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma lista criada.</p>
          ) : (
            <div className="divide-y">
              {lists.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{l.name}</div>
                    {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {l.member_count} contatos
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && <CreateListDialog onClose={() => { setCreateOpen(false); void refetch(); }} />}
    </div>
  );
}

function CreateListDialog({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Informe o nome da lista"); return; }
    setBusy(true);
    const { error } = await supabase.from("contact_lists").insert({
      name: name.trim(),
      description: description.trim() || null,
      created_by: profile?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lista criada!");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova lista</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Clientes SC" /></div>
          <div><Label className="text-xs">Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Criando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
