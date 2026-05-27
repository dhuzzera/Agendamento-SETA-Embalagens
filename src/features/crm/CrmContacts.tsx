import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";
import { ImportLeadsDialog } from "./ImportLeadsDialog";

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  company_id: string | null;
  cargo: string | null;
  created_at: string;
};

export function CrmContacts() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: contacts, isLoading, refetch } = useQuery({
    queryKey: ["crm-contacts", search],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, name, email, phone, company, company_id, cargo, created_at")
        .order("name");

      if (search.trim()) {
        q = q.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,company.ilike.%${search.trim()}%`);
      }

      const { data } = await q.limit(100);
      return (data ?? []) as Contact[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold">Contatos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Criar Contato
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar contato…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Contato</th>
                  <th className="px-4 py-3 text-left font-medium">Empresa</th>
                  <th className="px-4 py-3 text-left font-medium">E-mail</th>
                  <th className="px-4 py-3 text-left font-medium">Telefone</th>
                  <th className="px-4 py-3 text-left font-medium">Cargo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-4"><ListRowSkeleton /></td></tr>
                  ))
                ) : contacts?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum contato encontrado.
                    </td>
                  </tr>
                ) : (
                  contacts?.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.company ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.cargo ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {createOpen && <CreateContactDialog onClose={() => { setCreateOpen(false); void refetch(); }} />}
      <ImportLeadsDialog open={importOpen} onClose={() => { setImportOpen(false); void refetch(); }} stages={[]} />
    </div>
  );
}

function CreateContactDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cargo, setCargo] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    if (!email.trim()) { toast.error("Informe o e-mail"); return; }
    setBusy(true);
    const { error } = await supabase.from("clients").insert({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      company: company.trim() || null,
      cargo: cargo.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contato criado!");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do contato" />
          </div>
          <div>
            <Label className="text-xs">Cargo</Label>
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo do contato" />
          </div>
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 (47) 99999-9999" />
          </div>
          <div>
            <Label className="text-xs">E-mail *</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
          </div>
          <div>
            <Label className="text-xs">Empresa</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Criando…" : "Criar Contato"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
