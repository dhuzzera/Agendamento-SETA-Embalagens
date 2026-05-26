import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Copy, Link as LinkIcon, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { StatCardSkeleton, ListRowSkeleton } from "@/components/Skeletons";
import { HolidayConfirmDialog } from "./HolidayConfirmDialog";
import { getQrCodeUrl, downloadQrCode } from "@/lib/qr-code";
import { DayMapView } from "./DayMapView";
import { FeedbackCard } from "./FeedbackCard";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

export function RepDashboard() {
  const { profile, refresh } = useAuth();
  const [slugInput, setSlugInput] = useState(profile?.slug ?? "");

  useEffect(() => setSlugInput(profile?.slug ?? ""), [profile?.slug]);

  const repId = profile?.id;

  const { data: stats } = useQuery({
    queryKey: ["rep-dashboard", "stats", repId],
    enabled: !!repId,
    staleTime: 60_000,
    queryFn: async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const weekEnd = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");
      const [{ count: tdC }, { count: wkC }] = await Promise.all([
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("representative_id", repId!)
          .eq("appointment_date", todayStr),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("representative_id", repId!)
          .gte("appointment_date", todayStr)
          .lte("appointment_date", weekEnd),
      ]);
      return { today: tdC ?? 0, week: wkC ?? 0 };
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["rep-dashboard", "upcoming", repId],
    enabled: !!repId,
    staleTime: 60_000,
    queryFn: async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, client_id")
        .eq("representative_id", repId!)
        .gte("appointment_date", todayStr)
        .order("appointment_date")
        .order("start_time")
        .limit(8);
      if (!data?.length) return [];
      const cliIds = [...new Set(data.map((d) => d.client_id))];
      const { data: clis } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", cliIds);
      const cMap = new Map(clis?.map((c) => [c.id, c.name]));
      return data.map((d) => ({
        id: d.id,
        appointment_date: d.appointment_date,
        start_time: d.start_time,
        client_name: cMap.get(d.client_id) ?? "—",
      }));
    },
  });

  // Próximas regiões/cidades-base por dia (presenciais)
  const { data: regionDays } = useQuery({
    queryKey: ["rep-dashboard", "regions", repId],
    enabled: !!repId,
    staleTime: 60_000,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const horizon = format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd");
      const { data } = await supabase
        .from("appointments")
        .select("appointment_date, start_time, city, state, meeting_type, status")
        .eq("representative_id", repId!)
        .eq("meeting_type", "presencial")
        .in("status", ["scheduled", "rescheduled"])
        .gte("appointment_date", today)
        .lte("appointment_date", horizon)
        .order("appointment_date")
        .order("start_time");
      const map = new Map<string, { city: string; state: string; count: number }>();
      for (const r of data ?? []) {
        if (!r.city || !r.state) continue;
        const cur = map.get(r.appointment_date);
        if (!cur) {
          map.set(r.appointment_date, { city: r.city, state: r.state, count: 1 });
        } else {
          cur.count += 1;
        }
      }
      return [...map.entries()].map(([date, v]) => ({ date, ...v }));
    },
  });

  // Domínio público — usa a URL atual em produção, fallback para o domínio Lovable
  const PUBLIC_HOST =
    typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? window.location.host
      : (import.meta.env.VITE_PUBLIC_HOST ?? "seta-agendamento.lovable.app");
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
      <HolidayConfirmDialog representativeId={repId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Olá, {profile?.full_name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground">Sua agenda comercial SETA.</p>
        </div>
        <div className="flex gap-2">
          <PushNotificationToggle />
          {link && (
            <Button onClick={copyLink} variant="outline">
              <Copy className="mr-1.5 h-4 w-4" />
              Copiar meu link
            </Button>
          )}
          <Link to="/agenda">
            <Button>
              <Calendar className="mr-1.5 h-4 w-4" />
              Novo agendamento
            </Button>
          </Link>
        </div>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard to="/agenda" icon={<Calendar />} label="Hoje" value={stats.today} />
          <StatCard to="/agenda" icon={<Calendar />} label="Próximos 7 dias" value={stats.week} />
          <StatCard to="/disponibilidade" icon={<LinkIcon />} label="Slug" value={profile?.slug ?? "—"} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Seu link público de agendamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile?.slug ? (
            <>
              <div className="flex items-center gap-2">
                <Input readOnly value={linkDisplay} />
                <Button variant="outline" onClick={copyLink}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copiar
                </Button>
              </div>
              {/* QR Code */}
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-start">
                <img
                  src={getQrCodeUrl(link, 150)}
                  alt="QR Code do link público"
                  className="h-[150px] w-[150px] rounded-md border bg-white p-1"
                />
                <div className="text-center sm:text-left">
                  <p className="text-sm font-medium">QR Code para cartão de visita</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Seus clientes podem escanear para acessar diretamente sua página de agendamento.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => downloadQrCode(link, `qr-${profile.slug}.png`)}
                  >
                    Baixar QR Code (PNG)
                  </Button>
                </div>
              </div>
            </>
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

      {regionDays && regionDays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Agenda por região
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cada dia com visita presencial fica reservado para a cidade do primeiro agendamento. Demais clientes presenciais devem ser da mesma região.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {regionDays.map((d) => (
                <li key={d.date} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">
                      {format(new Date(d.date + "T00:00"), "EEE, dd/MM", { locale: ptBR })}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {d.city} - {d.state.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.count} {d.count === 1 ? "visita" : "visitas"} • bloqueado p/ esta região
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <DayMapView />

      <FeedbackCard />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Próximas reuniões</CardTitle>
          <Link to="/agenda" className="text-sm font-medium text-primary hover:underline">
            Ver agenda →
          </Link>
        </CardHeader>
        <CardContent>
          {upcoming === undefined ? (
            <div className="divide-y">
              <ListRowSkeleton />
              <ListRowSkeleton />
              <ListRowSkeleton />
            </div>
          ) : upcoming.length === 0 ? (
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
  to: "/agenda" | "/disponibilidade" | "/agendamento";
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
