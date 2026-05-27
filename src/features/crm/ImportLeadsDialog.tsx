import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Stage = { id: string; name: string };

type ParsedRow = {
  name: string;
  email: string;
  company: string;
  phone: string;
  title: string;
  value: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
};

export function ImportLeadsDialog({ open, onClose, stages }: Props) {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const [fileName, setFileName] = useState("");

  const parseCSV = (text: string): ParsedRow[] => {
    let lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];

    // RD Station exports start with "sep=," — skip it
    if (lines[0].startsWith("sep=")) {
      lines = lines.slice(1);
    }
    if (lines.length < 2) return [];

    // Detect separator (;  or ,)
    const sep = lines[0].includes(";") && !lines[0].includes('",') ? ";" : ",";

    // Parse CSV respecting quoted fields
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === sep && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/"/g, ""));

    // Map columns flexibly — supports both simple format and RD Station export
    const colMap = {
      name: headers.findIndex((h) => /^nome$|^name$|^contatos?$/.test(h)),
      email: headers.findIndex((h) => /email|e-mail/.test(h)),
      company: headers.findIndex((h) => /^empresa$|^company$|^razao|^razão/.test(h)),
      phone: headers.findIndex((h) => /telefone|phone|celular|fone/.test(h)),
      title: headers.findIndex((h) => /titulo|title|oportunidade|deal/.test(h)),
      value: headers.findIndex((h) => /valor único|valor|value|preço|preco/.test(h)),
      stage: headers.findIndex((h) => /^etapa$|^stage$/.test(h)),
      state: headers.findIndex((h) => /^estado$|estado \(uf\)/.test(h)),
      city: headers.findIndex((h) => /^cidade$/.test(h)),
      cnpj: headers.findIndex((h) => /cnpj/.test(h)),
      segment: headers.findIndex((h) => /segmento/.test(h)),
      cargo: headers.findIndex((h) => /^cargo$/.test(h)),
    };

    // If "nome" not found but "contatos" exists at end (RD deal export), use first column
    if (colMap.name < 0) colMap.name = 0;

    const parsed: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = parseLine(lines[i]);
      const row: ParsedRow = {
        name: colMap.name >= 0 ? cols[colMap.name] ?? "" : "",
        email: colMap.email >= 0 ? cols[colMap.email] ?? "" : "",
        company: colMap.company >= 0 ? cols[colMap.company] ?? "" : "",
        phone: colMap.phone >= 0 ? cols[colMap.phone] ?? "" : "",
        title: colMap.title >= 0 ? cols[colMap.title] ?? "" : "",
        value: colMap.value >= 0 ? cols[colMap.value] ?? "" : "",
      };
      // Precisa ter pelo menos nome ou email
      if (row.name || row.email) parsed.push(row);
    }
    return parsed;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      if (parsed.length === 0) {
        toast.error("Nenhum lead encontrado no arquivo. Verifique as colunas.");
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const doImport = async () => {
    if (!profile || rows.length === 0) return;
    setImporting(true);
    let success = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        // Create or find client
        let clientId: string | null = null;
        if (row.email) {
          const { data: existing } = await supabase
            .from("clients")
            .select("id")
            .eq("email", row.email)
            .maybeSingle();

          if (existing) {
            clientId = existing.id;
          } else {
            const { data: newClient } = await supabase
              .from("clients")
              .insert({
                name: row.name || row.email.split("@")[0],
                email: row.email,
                company: row.company || null,
                phone: row.phone || null,
              })
              .select("id")
              .single();
            clientId = newClient?.id ?? null;
          }
        } else if (row.name) {
          // No email — create with placeholder
          const { data: newClient } = await supabase
            .from("clients")
            .insert({
              name: row.name,
              email: `${row.name.toLowerCase().replace(/\s+/g, ".")}@importado.local`,
              company: row.company || null,
              phone: row.phone || null,
            })
            .select("id")
            .single();
          clientId = newClient?.id ?? null;
        }

        // Parse value
        const parsedValue = row.value
          ? parseFloat(row.value.replace(/[^\d.,]/g, "").replace(",", "."))
          : null;

        // Create deal
        const dealTitle = row.title || `${row.company || row.name} — Novo lead`;

        const { error } = await supabase.from("deals").insert({
          title: dealTitle,
          client_id: clientId,
          representative_id: profile.id,
          stage_id: stageId,
          value: parsedValue && !isNaN(parsedValue) ? parsedValue : null,
        });

        if (error) throw error;
        success++;
      } catch {
        errors++;
      }
    }

    setImporting(false);
    setResult({ success, errors });
    if (success > 0) toast.success(`${success} leads importados com sucesso!`);
    if (errors > 0) toast.error(`${errors} leads falharam na importação.`);
  };

  const reset = () => {
    setRows([]);
    setResult(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar leads por planilha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!result ? (
            <>
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFile}
                  className="hidden"
                />
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {fileName || "Arraste ou clique para selecionar um arquivo CSV"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => fileRef.current?.click()}
                >
                  Selecionar arquivo
                </Button>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Formato esperado (CSV):</p>
                <p className="mt-1 font-mono">nome;email;empresa;telefone;titulo;valor</p>
                <p className="mt-2">
                  O sistema detecta automaticamente as colunas pelos nomes do cabeçalho.
                  Separador: <code>;</code> ou <code>,</code>. Mínimo: nome ou email.
                </p>
              </div>

              {rows.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span><strong>{rows.length}</strong> leads encontrados no arquivo</span>
                  </div>

                  <div className="max-h-32 overflow-y-auto rounded-md border text-xs">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-2 py-1 text-left">Nome</th>
                          <th className="px-2 py-1 text-left">E-mail</th>
                          <th className="px-2 py-1 text-left">Empresa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rows.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1">{r.name || "—"}</td>
                            <td className="px-2 py-1">{r.email || "—"}</td>
                            <td className="px-2 py-1">{r.company || "—"}</td>
                          </tr>
                        ))}
                        {rows.length > 10 && (
                          <tr><td colSpan={3} className="px-2 py-1 text-muted-foreground">+{rows.length - 10} mais…</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <Label className="text-xs">Importar para o estágio:</Label>
                    <Select value={stageId} onValueChange={setStageId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="py-6 text-center">
              {result.errors === 0 ? (
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              ) : (
                <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
              )}
              <p className="mt-3 text-lg font-semibold">
                {result.success} importados
                {result.errors > 0 && `, ${result.errors} com erro`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Os leads foram adicionados ao pipeline.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
              <Button onClick={doImport} disabled={importing || rows.length === 0}>
                {importing ? "Importando…" : `Importar ${rows.length} leads`}
              </Button>
            </>
          ) : (
            <Button onClick={() => { reset(); onClose(); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
