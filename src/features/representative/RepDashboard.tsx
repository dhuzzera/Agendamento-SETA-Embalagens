import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Copy, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function RepDashboard() {
  const { profile, refresh } = useAuth();
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [upcoming, setUpcoming] = useState<
    { id: string; appointment_date: string; start_time: string; client_name: string }[]
  >([]);
  const [slugInput, setSlugInput] = useState(profile?.slug ?? "");

  useEffect(() => setSlugInput(profile?.slug ?? ""), [profile?.slug]);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const weekEnd = format(
        new Date(Date.now() + 7 * 86400000),
        "yyyy-MM-dd"
      );
      const { count: tdC } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("representative_id", profile.id)
        .eq("appointment_date", todayStr);
      const { count: wkC } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("representative_id", profile.id)
        .gte("appointment_date", todayStr)
        .lte("appointment_date", weekEnd);
      setToday(tdC ?? 0);
      setWeek(wkC ?? 0);

      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, client_id")
        .eq("representative_id", profile.id)
        .gte("appointment_date", todayStr)
        .order("appointment_date")
        .order("start_time")
        .limit(8);
      if (data?.length) {
        const cliIds = [...new Set(data.map((d) => d.client_id))];
        const { data: clis } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", cliIds);
        const cMap = new Map(clis?.map((c) => [c.id, c.name]));
        setUpcoming(
          data.map((d) => ({
            id: d.id,
            appointment_date: d.appointment_date,
            start_time: d.start_time,
            client_name: cMap.get(d.client_id) ?? "—",
          }))
        );
      }
    };
    void load();
  }, [profile]);

  // Domínio público curto e estável (independente de preview/sandbox)
  const PUBLIC_HOST = "seta-agendamento.lovable.app";
  const link = profile?.slug ? `https://${PUBLIC_HOST}/${profile.slug}` : "";
  const linkDisplay = profile?.slug ? `${PUBLIC_HOST}/${profile.slug}` : "";

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const saveSlug = async () => {
    if (!profile) return;
    const cleaned = slugInput.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { error } = await supabase
      .from("profiles")
      .update({ slug: cleaned || null })
      .eq("id", profile.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Link atualizado");
      await refresh();
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Olá, {profile?.full_name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground">Sua agenda comercial Seta.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard to="/agenda" icon={<Calendar />} label="Hoje" value={today} />
        <StatCard to="/agenda" icon={<Calendar />} label="Próximos 7 dias" value={week} />
        <StatCard to="/disponibilidade" icon={<LinkIcon />} label="Slug" value={profile?.slug ?? "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seu link público de agendamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile?.slug ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={linkDisplay} />
              <Button variant="outline" onClick={copyLink}>
                <Copy className="mr-1.5 h-4 w-4" /> Copiar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Defina um slug para gerar seu link público.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="ex: joao-silva"
            />
            <Button onClick={saveSlug}>Salvar slug</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Próximas reuniões</CardTitle>
          <Link to="/agenda" className="text-sm font-medium text-primary hover:underline">
            Ver agenda →
          </Link>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem reuniões agendadas.</p>
          ) : (
            <div className="divide-y">
              {upcoming.map((a) => (
                <Link
                  key={a.id}
                  to="/agenda"
                  className="-mx-6 flex items-center justify-between px-6 py-3 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium">{a.client_name}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(a.appointment_date + "T00:00"), "dd 'de' MMM", {
                      locale: ptBR,
                    })}{" "}
                    às {a.start_time.slice(0, 5)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to: "/agenda" | "/disponibilidade" | "/dashboard";
}) {
  return (
    <Link to={to} className="block">
      <Card className="transition-all hover:border-primary/40 hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
