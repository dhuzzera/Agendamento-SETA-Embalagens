import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SetaLogo } from "@/components/SetaLogo";
import {
  addDays,
  addMinutes,
  format,
  isBefore,
  parse,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  active: boolean;
};

type Avail = {
  weekday: number;
  start_time: string;
  end_time: string;
  meeting_duration_min: number;
};
type Block = { block_date: string; start_time: string | null; end_time: string | null };
type Appt = { appointment_date: string; start_time: string; end_time: string };

export function PublicBooking({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avails, setAvails] = useState<Avail[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<{ date: Date; start: string; end: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  // form
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, active")
        .eq("slug", slug)
        .maybeSingle();
      if (!p || !p.active) {
        setLoading(false);
        return;
      }
      setProfile(p as Profile);
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase
          .from("availabilities")
          .select("weekday, start_time, end_time, meeting_duration_min")
          .eq("representative_id", p.id)
          .eq("active", true),
        supabase
          .from("blocks")
          .select("block_date, start_time, end_time")
          .eq("representative_id", p.id),
      ]);
      setAvails((a as Avail[]) ?? []);
      setBlocks((b as Block[]) ?? []);
      setLoading(false);
    };
    void load();
  }, [slug]);

  // load appointments for the visible week
  useEffect(() => {
    if (!profile) return;
    const start = format(weekStart, "yyyy-MM-dd");
    const end = format(addDays(weekStart, 6), "yyyy-MM-dd");
    supabase
      .from("appointments")
      .select("appointment_date, start_time, end_time")
      .eq("representative_id", profile.id)
      .eq("status", "scheduled")
      .gte("appointment_date", start)
      .lte("appointment_date", end)
      .then(({ data }) => setAppts((data as Appt[]) ?? []));
  }, [profile, weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const slotsFor = (day: Date): { start: string; end: string }[] => {
    const wd = day.getDay();
    const dayAvails = avails.filter((a) => a.weekday === wd);
    if (dayAvails.length === 0) return [];
    const dateStr = format(day, "yyyy-MM-dd");
    const dayBlocks = blocks.filter((b) => b.block_date === dateStr);
    const fullDayBlocked = dayBlocks.some(
      (b) => !b.start_time && !b.end_time
    );
    if (fullDayBlocked) return [];
    const dayAppts = appts.filter((a) => a.appointment_date === dateStr);

    const slots: { start: string; end: string }[] = [];
    for (const a of dayAvails) {
      let cur = parse(a.start_time, "HH:mm:ss", day);
      const endTime = parse(a.end_time, "HH:mm:ss", day);
      while (!isBefore(endTime, addMinutes(cur, a.meeting_duration_min))) {
        const slotEnd = addMinutes(cur, a.meeting_duration_min);
        const sStr = format(cur, "HH:mm:ss");
        const eStr = format(slotEnd, "HH:mm:ss");

        const past = isBefore(cur, new Date());
        const blocked = dayBlocks.some(
          (b) =>
            b.start_time &&
            b.end_time &&
            sStr < b.end_time &&
            eStr > b.start_time
        );
        const taken = dayAppts.some(
          (ap) => sStr < ap.end_time && eStr > ap.start_time
        );
        if (!past && !blocked && !taken) {
          slots.push({ start: sStr, end: eStr });
        }
        cur = slotEnd;
      }
    }
    return slots;
  };

  const submit = async () => {
    if (!profile || !selected) return;
    if (!name || !email) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    setBusy(true);
    try {
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .insert({ name, company: company || null, email, phone: phone || null })
        .select("id")
        .single();
      if (cErr) throw cErr;
      const { error: aErr } = await supabase.from("appointments").insert({
        representative_id: profile.id,
        client_id: client.id,
        appointment_date: format(selected.date, "yyyy-MM-dd"),
        start_time: selected.start,
        end_time: selected.end,
        notes: notes || null,
      });
      if (aErr) throw aErr;
      setSuccess(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg.includes("já reservado") || msg.includes("uniq_appointment")) {
        toast.error("Esse horário acabou de ser reservado. Escolha outro.");
        setSelected(null);
        // reload
        const start = format(weekStart, "yyyy-MM-dd");
        const end = format(addDays(weekStart, 6), "yyyy-MM-dd");
        const { data } = await supabase
          .from("appointments")
          .select("appointment_date, start_time, end_time")
          .eq("representative_id", profile.id)
          .eq("status", "scheduled")
          .gte("appointment_date", start)
          .lte("appointment_date", end);
        setAppts((data as Appt[]) ?? []);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Representante não encontrado</h1>
          <p className="mt-2 text-muted-foreground">
            Verifique o link recebido com o representante Seta.
          </p>
        </div>
      </div>
    );
  }

  if (success && selected) {
    return (
      <div className="min-h-screen bg-secondary">
        <PublicHeader />
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-2xl border bg-card p-10 shadow-[var(--shadow-card)]">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <h1 className="mt-4 text-2xl font-bold">Reunião confirmada!</h1>
            <p className="mt-2 text-muted-foreground">
              Sua reunião com <strong>{profile.full_name}</strong> foi agendada para
            </p>
            <p className="mt-4 text-lg font-semibold text-primary">
              {format(selected.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}{" "}
              às {selected.start.slice(0, 5)}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Em breve você receberá uma confirmação no e-mail informado ({email}).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <PublicHeader />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Rep card */}
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-primary">
                {profile.full_name[0]}
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Agendar reunião com</p>
              <h1 className="text-2xl font-bold">{profile.full_name}</h1>
              <p className="text-sm text-muted-foreground">Representante Seta Embalagens</p>
            </div>
          </CardContent>
        </Card>

        {!selected ? (
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <CalIcon className="h-5 w-5" />
                  Horários disponíveis
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWeekStart(addDays(weekStart, -7))}
                    disabled={isBefore(weekStart, addDays(new Date(), 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {format(weekStart, "dd/MM", { locale: ptBR })} –{" "}
                    {format(addDays(weekStart, 6), "dd/MM", { locale: ptBR })}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWeekStart(addDays(weekStart, 7))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-7">
                {days.map((day) => {
                  const slots = slotsFor(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className="rounded-lg border bg-background p-3"
                    >
                      <div className="mb-2 text-center">
                        <div className="text-xs uppercase text-muted-foreground">
                          {format(day, "EEE", { locale: ptBR })}
                        </div>
                        <div className="text-lg font-bold text-primary">
                          {format(day, "dd")}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {slots.length === 0 ? (
                          <p className="text-center text-xs text-muted-foreground">—</p>
                        ) : (
                          slots.map((s) => (
                            <button
                              key={s.start}
                              onClick={() =>
                                setSelected({ date: day, start: s.start, end: s.end })
                              }
                              className="w-full rounded-md border border-primary/30 bg-secondary px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                              {s.start.slice(0, 5)}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Confirme seus dados</h2>
                  <p className="text-sm text-muted-foreground">
                    {format(selected.date, "EEEE, dd 'de' MMMM", { locale: ptBR })} •{" "}
                    {selected.start.slice(0, 5)} – {selected.end.slice(0, 5)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                  Trocar horário
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Nome *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Empresa</Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div>
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Conte sobre o que pretende discutir…"
                  />
                </div>
              </div>

              <Button
                onClick={submit}
                disabled={busy}
                className="mt-6 w-full"
                size="lg"
              >
                {busy ? "Confirmando…" : "Confirmar agendamento"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <SetaLogo variant="light" />
        <span className="text-xs text-sidebar-foreground/80">Agendamento Comercial</span>
      </div>
    </header>
  );
}
