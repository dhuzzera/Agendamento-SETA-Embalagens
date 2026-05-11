import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { SetaLogo } from "@/components/SetaLogo";
import {
  addMinutes,
  endOfMonth,
  format,
  isBefore,
  parse,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  Calendar as CalIcon,
  Download,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  type CalendarEvent,
} from "@/lib/calendar";

type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  active: boolean;
};

type Avail = {
  weekday: number;
  start_time: string;
  end_time: string;
  meeting_duration_min: number;
};
type Block = {
  block_date: string;
  start_time: string | null;
  end_time: string | null;
};
type Appt = { appointment_date: string; start_time: string; end_time: string };

export function PublicBooking({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avails, setAvails] = useState<Avail[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selected, setSelected] = useState<{
    date: Date;
    start: string;
    end: string;
  } | null>(null);
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
        .select("id, full_name, avatar_url, bio, active")
        .eq("slug", slug)
        .maybeSingle();
      if (!p || !p.active) {
        setLoading(false);
        return;
      }
      setProfile(p as Profile);
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase
          .from("availabilities")
          .select("weekday, start_time, end_time, meeting_duration_min")
          .eq("representative_id", p.id)
          .eq("active", true),
        supabase
          .from("blocks")
          .select("block_date, start_time, end_time")
          .eq("representative_id", p.id)
          .gte("block_date", today),
      ]);
      setAvails((a as Avail[]) ?? []);
      setBlocks((b as Block[]) ?? []);
      setLoading(false);
    };
    void load();
  }, [slug]);

  // load appointments for the visible month
  useEffect(() => {
    if (!profile) return;
    const start = format(startOfMonth(month), "yyyy-MM-dd");
    const end = format(endOfMonth(month), "yyyy-MM-dd");
    setLoadedMonth(null);
    supabase
      .from("appointments")
      .select("appointment_date, start_time, end_time")
      .eq("representative_id", profile.id)
      .eq("status", "scheduled")
      .gte("appointment_date", start)
      .lte("appointment_date", end)
      .then(({ data }) => {
        setAppts((data as Appt[]) ?? []);
        setLoadedMonth(start);
      });
  }, [profile, month]);

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

  // Weekdays the rep ever works on (0=Sun..6=Sat)
  const workingWeekdays = useMemo(() => {
    const set = new Set<number>();
    for (const a of avails) set.add(a.weekday);
    return set;
  }, [avails]);

  // Days fully blocked in the current month (for disable in calendar)
  const fullyBlockedDates = useMemo(() => {
    const set = new Set<string>();
    for (const b of blocks) {
      if (!b.start_time && !b.end_time) set.add(b.block_date);
    }
    return set;
  }, [blocks]);

  // Days in the visible month that actually have at least one bookable slot
  const availableDates = useMemo(() => {
    if (!profile) return [] as Date[];
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const result: Date[] = [];
    const today = startOfDay(new Date());
    const cursor = new Date(start);
    while (cursor <= end) {
      const d = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
      if (isBefore(d, today)) continue;
      if (!workingWeekdays.has(d.getDay())) continue;
      if (fullyBlockedDates.has(format(d, "yyyy-MM-dd"))) continue;
      if (slotsFor(d).length > 0) result.push(d);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, month, avails, blocks, appts, workingWeekdays, fullyBlockedDates]);

  const availableDateKeys = useMemo(
    () => new Set(availableDates.map((d) => format(d, "yyyy-MM-dd"))),
    [availableDates],
  );

  const isDayDisabled = (day: Date) => {
    if (isBefore(day, startOfDay(new Date()))) return true;
    if (!workingWeekdays.has(day.getDay())) return true;
    if (fullyBlockedDates.has(format(day, "yyyy-MM-dd"))) return true;
    // If we already loaded the month's appointments, hide days with no slots
    if (
      loadedMonth === format(startOfMonth(month), "yyyy-MM-dd") &&
      !availableDateKeys.has(format(day, "yyyy-MM-dd"))
    ) {
      return true;
    }
    return false;
  };

  const slotsForSelected = useMemo(() => {
    if (!selectedDate) return [];
    return slotsFor(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, avails, blocks, appts]);

  // Group slots by period of day for easier scanning on mobile
  const groupedSlots = useMemo(() => {
    type Slot = { start: string; end: string };
    const groups: Record<"morning" | "afternoon" | "evening", Slot[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const s of slotsForSelected) {
      const h = parseInt(s.start.slice(0, 2), 10);
      if (h < 12) groups.morning.push(s);
      else if (h < 18) groups.afternoon.push(s);
      else groups.evening.push(s);
    }
    return groups;
  }, [slotsForSelected]);

  const slotsLoading =
    !!selectedDate && loadedMonth !== format(startOfMonth(month), "yyyy-MM-dd");

  // Auto-select the first available day of the month once data is loaded,
  // so the user immediately sees time slots without an extra tap.
  useEffect(() => {
    if (selectedDate) return;
    if (loadedMonth !== format(startOfMonth(month), "yyyy-MM-dd")) return;
    if (availableDates.length === 0) return;
    setSelectedDate(availableDates[0]);
  }, [loadedMonth, month, availableDates, selectedDate]);

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
        .insert({
          name,
          company: company || null,
          email,
          phone: phone || null,
        })
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
        // reload appointments for the month
        const start = format(startOfMonth(month), "yyyy-MM-dd");
        const end = format(endOfMonth(month), "yyyy-MM-dd");
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
    return <BookingSkeleton />;
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
    const calendarEvent: CalendarEvent = {
      title: `Reunião com ${profile.full_name} — Seta Embalagens`,
      description: `Reunião comercial com ${profile.full_name}.${
        notes ? `\n\nObservações: ${notes}` : ""
      }`,
      date: format(selected.date, "yyyy-MM-dd"),
      startTime: selected.start,
      endTime: selected.end,
      organizerName: profile.full_name,
      attendeeEmail: email,
      attendeeName: name,
    };
    const googleUrl = buildGoogleCalendarUrl(calendarEvent);
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

            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Adicionar ao calendário</p>
              <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row">
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  <CalIcon className="h-4 w-4" />
                  Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() =>
                    downloadIcsFile(
                      calendarEvent,
                      `reuniao-${format(selected.date, "yyyy-MM-dd")}.ics`
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  <Download className="h-4 w-4" />
                  Baixar .ics (Apple/Outlook)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <PublicHeader />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Rep card */}
        <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
          <div
            className="h-20 sm:h-24"
            style={{ background: "var(--gradient-hero)" }}
          />
          <CardContent className="-mt-12 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-end">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-24 w-24 rounded-full border-4 border-card object-cover shadow-md"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-secondary text-3xl font-bold text-primary shadow-md">
                {profile.full_name[0]}
              </div>
            )}
            <div className="pb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Agendar reunião com
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {profile.full_name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalIcon className="h-3.5 w-3.5" />
                Representante Seta Embalagens
              </p>
            </div>
          </CardContent>
          {profile.bio && (
            <div className="border-t bg-muted/20 px-6 py-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            </div>
          )}
        </Card>

        {!selected ? (
          <Card className="mt-6 border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-[1fr_320px]">
                {/* Calendar */}
                <div className="border-b p-6 lg:border-b-0 lg:border-r">
                  <div className="mb-4">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <CalIcon className="h-5 w-5 text-primary" />
                      Selecione uma data
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Os dias com horários disponíveis estão destacados.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      locale={ptBR}
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      month={month}
                      onMonthChange={setMonth}
                      disabled={isDayDisabled}
                      showOutsideDays={false}
                      modifiers={{ available: availableDates }}
                      modifiersClassNames={{
                        available:
                          "relative font-semibold text-primary after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                      }}
                      className={cn(
                        "pointer-events-auto p-0 [--cell-size:2.75rem] sm:[--cell-size:2.5rem]",
                      )}
                    />
                  </div>

                  {/* Legend */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                      Com horários disponíveis
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      Indisponível
                    </span>
                  </div>
                </div>

                {/* Slots */}
                <div className="p-6">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Horários
                      </h3>
                      {selectedDate && (
                        <p className="mt-1 text-sm font-medium capitalize text-foreground">
                          {format(selectedDate, "EEEE, dd 'de' MMMM", {
                            locale: ptBR,
                          })}
                        </p>
                      )}
                    </div>
                    {selectedDate && !slotsLoading && slotsForSelected.length > 0 && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {slotsForSelected.length}{" "}
                        {slotsForSelected.length === 1 ? "horário" : "horários"}
                      </span>
                    )}
                  </div>

                  {!selectedDate ? (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                      <CalIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Escolha uma data para ver os horários disponíveis.
                      </p>
                    </div>
                  ) : slotsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : slotsForSelected.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhum horário disponível neste dia.
                      </p>
                      {availableDates.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => setSelectedDate(availableDates[0])}
                        >
                          Ver próxima data disponível
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 lg:max-h-[460px]">
                      {(
                        [
                          ["morning", "Manhã"],
                          ["afternoon", "Tarde"],
                          ["evening", "Noite"],
                        ] as const
                      ).map(([key, label]) =>
                        groupedSlots[key].length === 0 ? null : (
                          <div key={key}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {label}
                            </p>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                              {groupedSlots[key].map((s) => (
                                <button
                                  key={s.start}
                                  onClick={() =>
                                    setSelected({
                                      date: selectedDate,
                                      start: s.start,
                                      end: s.end,
                                    })
                                  }
                                  className="flex min-h-11 w-full items-center justify-center rounded-md border-2 border-primary/20 bg-background px-3 py-2.5 text-sm font-semibold text-primary transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-sm active:scale-[0.98]"
                                >
                                  {s.start.slice(0, 5)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6 border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-6">
              <div className="mb-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Confirme seus dados</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalIcon className="h-3.5 w-3.5" />
                    {format(selected.date, "EEEE, dd 'de' MMMM", {
                      locale: ptBR,
                    })}{" "}
                    • {selected.start.slice(0, 5)} – {selected.end.slice(0, 5)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Trocar horário
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <a
          href="https://setaembalagens.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center"
          aria-label="Seta Embalagens — site institucional"
        >
          <SetaLogo variant="dark" />
        </a>
        <span className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-primary sm:inline">
          Agendamento Comercial
        </span>
      </div>
    </header>
  );
}

function BookingSkeleton() {
  return (
    <div className="min-h-screen bg-secondary">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
          <Skeleton className="h-20 w-full sm:h-24" />
          <CardContent className="-mt-12 flex items-end gap-4 p-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-2 pb-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-3 w-48" />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-0">
            <div className="grid lg:grid-cols-[1fr_320px]">
              <div className="border-b p-6 lg:border-b-0 lg:border-r">
                <Skeleton className="mb-4 h-6 w-48" />
                <Skeleton className="h-72 w-full" />
              </div>
              <div className="space-y-2 p-6">
                <Skeleton className="mb-4 h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
