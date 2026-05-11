import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type RepRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  slug: string | null;
  active: boolean;
  role: "admin" | "representative";
};

export function UserManagement() {
  const [users, setUsers] = useState<RepRow[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<RepRow | null>(null);

  const load = async () => {
    const { data: profs } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, "admin" | "representative">();
    roles?.forEach((r) => {
      const cur = roleMap.get(r.user_id);
      if (r.role === "admin" || !cur) roleMap.set(r.user_id, r.role);
    });
    setUsers(
      (profs ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        slug: p.slug,
        active: p.active,
        role: roleMap.get(p.id) ?? "representative",
      }))
    );
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleActive = async (u: RepRow) => {
    const { error } = await supabase
      .from("profiles")
      .update({ active: !u.active })
      .eq("id", u.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado");
      void load();
    }
  };

  const remove = async (u: RepRow) => {
    if (!confirm(`Excluir ${u.full_name}? Esta ação removerá agenda e dados.`)) return;
    // Calls a server-side RPC or admin API. Without service role on client we can only
    // delete the profile row; auth user remains. For now, deactivate.
    const { error } = await supabase.from("profiles").update({ active: false }).eq("id", u.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Usuário desativado (exclusão completa requer painel)");
      void load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de usuários</h1>
          <p className="text-muted-foreground">
            Administradores e representantes da operação Seta.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Novo usuário
            </Button>
          </DialogTrigger>
          <UserDialog
            edit={edit}
            onClose={() => {
              setOpen(false);
              setEdit(null);
              void load();
            }}
          />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.full_name}</span>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role === "admin" ? "Admin" : "Representante"}
                    </Badge>
                    {!u.active && <Badge variant="destructive">Inativo</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {u.email} {u.phone && `• ${u.phone}`}
                  </div>
                  {u.slug && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      /agendar/{u.slug}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={u.active} onCheckedChange={() => toggleActive(u)} />
                    <span className="text-xs text-muted-foreground">Ativo</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEdit(u);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(u)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserDialog({
  edit,
  onClose,
}: {
  edit: RepRow | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(edit?.full_name ?? "");
  const [email, setEmail] = useState(edit?.email ?? "");
  const [phone, setPhone] = useState(edit?.phone ?? "");
  const [slug, setSlug] = useState(edit?.slug ?? "");
  const [role, setRole] = useState<"admin" | "representative">(edit?.role ?? "representative");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (edit) {
        const { error } = await supabase
          .from("profiles")
          .update({ full_name: name, phone, slug: slug || null })
          .eq("id", edit.id);
        if (error) throw error;

        // Update role
        if (role !== edit.role) {
          await supabase.from("user_roles").delete().eq("user_id", edit.id);
          await supabase.from("user_roles").insert({ user_id: edit.id, role });
        }
        toast.success("Usuário atualizado");
      } else {
        if (!password || password.length < 6) {
          toast.error("Senha mínima de 6 caracteres");
          setBusy(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, phone } },
        });
        if (error) throw error;
        const uid = data.user?.id;
        if (uid) {
          await supabase.from("profiles").update({ phone, slug: slug || null }).eq("id", uid);
          if (role === "admin") {
            await supabase.from("user_roles").delete().eq("user_id", uid);
            await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
          }
        }
        toast.success("Usuário criado");
      }
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{edit ? "Editar usuário" : "Novo usuário"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Nome completo</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!edit}
          />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Slug do link público</Label>
          <Input
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
            }
            placeholder="ex: joao-silva"
          />
        </div>
        <div>
          <Label>Perfil de acesso</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="representative">Representante</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!edit && (
          <div>
            <Label>Senha provisória</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
