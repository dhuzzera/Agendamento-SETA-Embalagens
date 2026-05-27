import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

export function MarketingTemplates() {
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ["marketing-templates"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("id, name, subject, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const deleteTemplate = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await supabase.from("email_templates").delete().eq("id", id);
    toast.success("Template excluído");
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates de e-mail</h1>
          <p className="text-muted-foreground">Modelos reutilizáveis para suas campanhas.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo template
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><ListRowSkeleton /><ListRowSkeleton /></div>
          ) : !templates?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum template criado.</p>
          ) : (
            <div className="divide-y">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium">{t.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Assunto: {t.subject}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => void deleteTemplate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && <CreateTemplateDialog onClose={() => { setCreateOpen(false); void refetch(); }} />}
    </div>
  );
}

function CreateTemplateDialog({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const submit = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) { toast.error("Preencha todos os campos"); return; }
    setBusy(true);
    const { error } = await supabase.from("email_templates").insert({
      name: name.trim(),
      subject: subject.trim(),
      html_body: body.trim(),
      created_by: profile?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template criado!");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo template</DialogTitle></DialogHeader>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas" /></div>
            <div><Label className="text-xs">Assunto *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Bem-vindo à SETA!" /></div>
            <div>
              <Label className="text-xs">Corpo do e-mail (HTML) *</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} placeholder="<h1>Olá {{nome}}</h1>" />
              <p className="mt-1 text-xs text-muted-foreground">Variáveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{email}}"}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Pré-visualização</Label>
            </div>
            <div className="rounded-lg border bg-white p-4 text-sm text-black min-h-[200px] max-h-[400px] overflow-y-auto">
              {body ? (
                <div dangerouslySetInnerHTML={{ __html: body.replace(/\{\{nome\}\}/gi, "João").replace(/\{\{empresa\}\}/gi, "Empresa X").replace(/\{\{email\}\}/gi, "joao@empresa.com") }} />
              ) : (
                <p className="text-gray-400 italic">O preview aparece aqui conforme você digita o HTML…</p>
              )}
            </div>
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
