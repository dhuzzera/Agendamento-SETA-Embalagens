import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Send, Mail, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ListRowSkeleton } from "@/components/Skeletons";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  sent_at: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  scheduled: { label: "Agendada", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  sending: { label: "Enviando", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  sent: { label: "Enviada", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

export function MarketingCampaigns() {
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: campaigns, isLoading, refetch } = useQuery({
    queryKey: ["marketing-campaigns"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, subject, status, total_recipients, total_sent, total_opened, sent_at, created_at")
        .order("created_at", { ascending: false });
      return (data ?? []) as Campaign[];
    },
  });

  const { data: lists } = useQuery({
    queryKey: ["marketing-lists-select"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("contact_lists").select("id, name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const sendCampaign = async (id: string) => {
    if (!confirm("Enviar esta campanha agora? Os e-mails serão disparados imediatamente.")) return;

    toast.info("Enviando campanha…");

    const { data, error } = await supabase.functions.invoke("send-campaign", {
      body: { campaignId: id },
    });

    if (error) {
      toast.error("Erro ao enviar: " + error.message);
      return;
    }

    const result = data as { sent?: number; total?: number; error?: string };
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Campanha enviada! ${result.sent ?? 0} de ${result.total ?? 0} e-mails disparados.`);
    }
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campanhas</h1>
          <p className="text-muted-foreground">Crie e gerencie campanhas de e-mail marketing.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Mail className="h-5 w-5 text-primary" />
          <div><div className="text-lg font-bold">{campaigns?.length ?? 0}</div><div className="text-xs text-muted-foreground">Total</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Send className="h-5 w-5 text-green-500" />
          <div><div className="text-lg font-bold">{campaigns?.filter((c) => c.status === "sent").length ?? 0}</div><div className="text-xs text-muted-foreground">Enviadas</div></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Clock className="h-5 w-5 text-blue-500" />
          <div><div className="text-lg font-bold">{campaigns?.filter((c) => c.status === "draft").length ?? 0}</div><div className="text-xs text-muted-foreground">Rascunhos</div></div>
        </CardContent></Card>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><ListRowSkeleton /><ListRowSkeleton /><ListRowSkeleton /></div>
          ) : !campaigns?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma campanha criada.</p>
          ) : (
            <div className="divide-y">
              {campaigns.map((c) => {
                const st = STATUS_LABELS[c.status];
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.subject}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${st?.color ?? ""}`}>
                          {st?.label ?? c.status}
                        </span>
                        {c.sent_at && (
                          <span className="text-xs text-muted-foreground">
                            Enviada em {format(new Date(c.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === "sent" && (
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{c.total_sent} enviados</div>
                          <div>{c.total_opened} abertos</div>
                        </div>
                      )}
                      {c.status === "draft" && (
                        <Button size="sm" onClick={() => void sendCampaign(c.id)}>
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Enviar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <CreateCampaignDialog
          lists={lists ?? []}
          onClose={() => { setCreateOpen(false); void refetch(); }}
        />
      )}
    </div>
  );
}

function CreateCampaignDialog({ lists, onClose }: { lists: { id: string; name: string }[]; onClose: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [listId, setListId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);

  // Load templates
  const { data: templates } = useQuery({
    queryKey: ["marketing-templates-select"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("email_templates").select("id, name, subject, html_body");
      return (data ?? []) as { id: string; name: string; subject: string; html_body: string }[];
    },
  });

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates?.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.html_body);
      toast.success(`Template "${tpl.name}" aplicado`);
    }
  };

  const submit = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Preencha nome, assunto e conteúdo");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("campaigns").insert({
      name: name.trim(),
      subject: subject.trim(),
      html_body: body.trim(),
      template_id: templateId || null,
      list_id: listId || null,
      status: "draft",
      created_by: profile?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campanha criada como rascunho!");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome da campanha *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção de inverno" />
            </div>
            <div>
              <Label className="text-xs">Usar template</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue placeholder="Selecionar template (opcional)" /></SelectTrigger>
                <SelectContent>
                  {(templates ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assunto do e-mail *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Novidades SETA Embalagens" />
            </div>
            <div>
              <Label className="text-xs">Lista de destinatários</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger><SelectValue placeholder="Todos os contatos" /></SelectTrigger>
                <SelectContent>
                  {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Se não selecionar, envia pra todos os contatos.</p>
            </div>
            <div>
              <Label className="text-xs">Conteúdo do e-mail (HTML) *</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="<h1>Olá {{nome}}</h1><p>...</p>" />
              <p className="mt-1 text-xs text-muted-foreground">Variáveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{email}}"}</p>
            </div>
          </div>
          {/* Preview */}
          <div>
            <Label className="text-xs mb-2 block">Pré-visualização</Label>
            <div className="rounded-lg border bg-white p-3 text-sm text-black min-h-[200px] max-h-[350px] overflow-y-auto">
              {body ? (
                <div dangerouslySetInnerHTML={{ __html: body.replace(/\{\{nome\}\}/gi, "João").replace(/\{\{empresa\}\}/gi, "Empresa X").replace(/\{\{email\}\}/gi, "joao@empresa.com") }} />
              ) : (
                <p className="text-gray-400 italic">Preview do e-mail…</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Criando…" : "Criar rascunho"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
