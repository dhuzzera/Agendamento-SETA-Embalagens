import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Users, Handshake, Building2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Result = {
  id: string;
  type: "client" | "deal" | "company" | "appointment";
  title: string;
  subtitle?: string;
  url: string;
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();

      const [{ data: clients }, { data: deals }, { data: companies }] = await Promise.all([
        supabase.from("clients").select("id, name, email, company").or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`).limit(5),
        supabase.from("deals").select("id, title, client_id").ilike("title", `%${q}%`).limit(5),
        supabase.from("companies").select("id, name, city, state").ilike("name", `%${q}%`).limit(5),
      ]);

      const res: Result[] = [
        ...(clients ?? []).map((c) => ({
          id: c.id,
          type: "client" as const,
          title: c.name,
          subtitle: c.company ?? c.email,
          url: `/crm/cliente/${c.id}`,
        })),
        ...(deals ?? []).map((d) => ({
          id: d.id,
          type: "deal" as const,
          title: d.title,
          subtitle: "Negociação",
          url: `/crm/deal/${d.id}`,
        })),
        ...(companies ?? []).map((c) => ({
          id: c.id,
          type: "company" as const,
          title: c.name,
          subtitle: c.city ? `${c.city}${c.state ? ` - ${c.state}` : ""}` : undefined,
          url: `/crm/empresas`,
        })),
      ];

      setResults(res);
      setOpen(res.length > 0);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const icons = {
    client: <Users className="h-4 w-4 text-blue-500" />,
    deal: <Handshake className="h-4 w-4 text-purple-500" />,
    company: <Building2 className="h-4 w-4 text-orange-500" />,
    appointment: <Calendar className="h-4 w-4 text-green-500" />,
  };

  const typeLabels = {
    client: "Contato",
    deal: "Negociação",
    company: "Empresa",
    appointment: "Reunião",
  };

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar cliente, deal, empresa…"
          className="pl-9 h-8 text-sm"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-card shadow-lg overflow-hidden">
          {loading ? (
            <p className="p-3 text-sm text-muted-foreground">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhum resultado.</p>
          ) : (
            <div className="divide-y max-h-64 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    navigate({ to: r.url as "/" });
                  }}
                >
                  {icons[r.type]}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    {r.subtitle && <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{typeLabels[r.type]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
