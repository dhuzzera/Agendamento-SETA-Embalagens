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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

export function MarketingLists() {
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [managingList, setManagingList] = useState<{ id: string; name: string } | null>(null);

  const { data: lists, isLoading, refetch } = useQuery({
    queryKey: ["marketing-lists"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_lists")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: false });

      if (!data?.length) return [];

      const { data: members } = await supabase.from("contact_list_members").select("list_id");
      const countMap = new Map<string, number>();
      for (const m of members ?? []) {
        countMap.set(m.list_id, (countMap.get(m.list_id) ?? 0) + 1);
      }

      return data.map((l) => ({ ...l, member_count: countMap.get(l.id) ?? 0 }));
    },
  });

  const deleteList = async (id: string) => {
    if (!confirm("Excluir esta lista?")) return;
    await supabase.from("contact_lists").delete().eq("id", id);
    toast.success("Lista excluída");
    void refetch();
  };

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
                <div key={l.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => setManagingList({ id: l.id, name: l.name })}
                  >
                    <div className="font-medium">{l.name}</div>
                    {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {l.member_count}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => setManagingList({ id: l.id, name: l.name })}>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Gerenciar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void deleteList(l.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && <CreateListDialog onClose={() => { setCreateOpen(false); void refetch(); }} />}
      {managingList && <ManageListMembersDialog list={managingList} onClose={() => { setManagingList(null); void refetch(); }} />}
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

function ManageListMembersDialog({ list, onClose }: { list: { id: string; name: string }; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Load all contacts
  const { data: allContacts } = useQuery({
    queryKey: ["all-contacts-for-list"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, company")
        .order("name")
        .limit(500);
      return (data ?? []) as { id: string; name: string; email: string; company: string | null }[];
    },
  });

  // Load current members
  const { data: currentMembers, refetch: refetchMembers } = useQuery({
    queryKey: ["list-members", list.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_list_members")
        .select("client_id")
        .eq("list_id", list.id);
      const ids = new Set((data ?? []).map((m) => m.client_id));
      setSelectedIds(ids);
      return ids;
    },
  });

  const filtered = (allContacts ?? []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company ?? "").toLowerCase().includes(q);
  });

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  const save = async () => {
    setBusy(true);
    // Remove all current members
    await supabase.from("contact_list_members").delete().eq("list_id", list.id);

    // Insert selected
    if (selectedIds.size > 0) {
      const rows = [...selectedIds].map((clientId) => ({
        list_id: list.id,
        client_id: clientId,
      }));
      await supabase.from("contact_list_members").insert(rows);
    }

    setBusy(false);
    toast.success(`${selectedIds.size} contatos na lista "${list.name}"`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar contatos — {list.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contato…"
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={selectAll}>
              Selecionar todos
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedIds.size} selecionados de {allContacts?.length ?? 0} contatos
          </p>

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</p>
            ) : (
              filtered.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={() => toggleContact(c.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.email}{c.company ? ` • ${c.company}` : ""}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Salvando…" : `Salvar (${selectedIds.size} contatos)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
