import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { SetaLogo } from "@/components/SetaLogo";
import { MapPickerDialog } from "@/components/MapPickerDialog";
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
  ArrowLeft,
  MapPin,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar";
import { ClientCalendarTutorial } from "./ClientCalendarTutorial";

// Calendar helpers are loaded on demand only after a booking is confirmed,
// keeping them out of the initial bundle for the public page.
type CalendarLib = typeof import("@/lib/calendar");
let calendarLibPromise: Promise<CalendarLib> | null = null;
const loadCalendarLib = () => {
  if (!calendarLibPromise) {
    calendarLibPromise = import("@/lib/calendar");
  }
  return calendarLibPromise;
};

type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  active: boolean;
  allow_online: boolean;
  allow_presencial: boolean;
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
type Appt = {
  appointment_date: string;
  start_time: string;
  end_time: string;
  meeting_type: "online" | "presencial" | string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase();

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
  const [meetingType, setMeetingType] = useState<"online" | "presencial">("online");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [cep, setCep] = useState("");
  const [cepBusy, setCepBusy] = useState(false);
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [streetBase, setStreetBase] = useState(""); // logradouro + bairro from ViaCEP

  const formatCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepBusy(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      const localidade: string = data.localidade ?? "";
      const uf: string = (data.uf ?? "").toUpperCase();
      const logradouro: string = data.logradouro ?? "";
      const bairro: string = data.bairro ?? "";
      const base = [logradouro, bairro].filter(Boolean).join(" - ");
      setCity(localidade);
      setStateUf(uf);
      setStreetBase(base);
      // compose initial address
      const parts = [base, addressNumber && `nº ${addressNumber}`, addressComplement]
        .filter(Boolean)
        .join(", ");
      setAddress(parts);
      toast.success("Endereço preenchido pelo CEP");
    } catch {
      toast.error("Erro ao consultar o CEP");
    } finally {
      setCepBusy(false);
    }
  };

  // Recompose address whenever number/complement change after a CEP lookup
  useEffect(() => {
    if (!streetBase) return;
    const parts = [streetBase, addressNumber && `nº ${addressNumber}`, addressComplement]
      .filter(Boolean)
      .join(", ");
    setAddress(parts);
  }, [streetBase, addressNumber, addressComplement]);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [travelBufferMin, setTravelBufferMin] = useState(180);
  const [maxDistanceKm, setMaxDistanceKm] = useState(30);

  const requestGeolocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocalização não suportada neste navegador");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGeoBusy(false);
        toast.success("Localização capturada com sucesso");
      },
      (err) => {
        setGeoBusy(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada"
            : "Não foi possível obter a localização"
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  const [busy, setBusy] = useState(false);
  const [calendarLib, setCalendarLib] = useState<CalendarLib | null>(null);

  // Load calendar helpers only after a confirmed booking
  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    void loadCalendarLib().then((m) => {
      if (!cancelled) setCalendarLib(m);
    });
    return () => {
      cancelled = true;
    };
  }, [success]);

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, active, allow_online, allow_presencial")
        .eq("slug", slug)
        .maybeSingle();
      if (!p || !p.active) {
        setLoading(false);
        return;
      }
      setProfile(p as Profile);
      // Pré-seleciona modalidade conforme o que o representante aceita
      if (!p.allow_online && p.allow_presencial) setMeetingType("presencial");
      else setMeetingType("online");
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
    void Promise.all([
      supabase
        .from("appointments")
        .select("appointment_date, start_time, end_time, meeting_type, city, state, latitude, longitude")
        .eq("representative_id", profile.id)
        .eq("status", "scheduled")
        .gte("appointment_date", start)
        .lte("appointment_date", end),
      supabase.from("app_settings").select("travel_buffer_minutes, max_distance_km").eq("id", 1).maybeSingle(),
    ]).then(([apptsRes, settingsRes]) => {
      setAppts((apptsRes.data as Appt[]) ?? []);
      const buf = (settingsRes.data?.travel_buffer_minutes as number | undefined) ?? 180;
      const km = (settingsRes.data?.max_distance_km as number | undefined) ?? 30;
      setTravelBufferMin(buf);
      setMaxDistanceKm(km);
      setLoadedMonth(start);
    });
  }, [profile, month]);

  // Region locked for the day, if any presencial already exists
  const dayRegion = (
    dateStr: string,
  ): {
    city: string;
    state: string;
    latitude: number | null;
    longitude: number | null;
  } | null => {
    const presenciais = appts
      .filter(
        (a) =>
          a.appointment_date === dateStr &&
          a.meeting_type === "presencial" &&
          a.city &&
          a.state,
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (presenciais.length === 0) return null;
    const first = presenciais[0];
    return {
      city: first.city ?? "",
      state: first.state ?? "",
      latitude: first.latitude,
      longitude: first.longitude,
    };
  };

  // Returns minutes-to-time helpers
  const addMinToHHMMSS = (t: string, mins: number) => {
    const [h, m, s] = t.split(":").map((v) => parseInt(v, 10));
    const total = h * 60 + m + mins;
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}:${String(s ?? 0).padStart(2, "0")}`;
  };

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

    // If this is a presencial booking and the day already has a region locked,
    // require the new visit to be within max_distance_km of the first visit
    // (using GPS coords). Fallback to same city/UF when coords are missing.
    if (meetingType === "presencial") {
      const region = dayRegion(dateStr);
      if (region) {
        if (
          region.latitude != null &&
          region.longitude != null &&
          latitude != null &&
          longitude != null
        ) {
          const dist = haversineKm(
            region.latitude,
            region.longitude,
            latitude,
            longitude,
          );
          if (dist > maxDistanceKm) return [];
        } else if (
          norm(region.city) !== norm(city) ||
          norm(region.state) !== norm(stateUf)
        ) {
          return [];
        }
      }
    }

    // Build presencial buffer windows for the day
    const presBuffers =
      meetingType === "presencial"
        ? dayAppts
            .filter((a) => a.meeting_type === "presencial")
            .map((a) => ({
              start: addMinToHHMMSS(a.start_time, -travelBufferMin),
              end: addMinToHHMMSS(a.end_time, travelBufferMin),
            }))
        : [];

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
        const travelConflict = presBuffers.some(
          (b) => sStr < b.end && eStr > b.start,
        );
        if (!past && !blocked && !taken && !travelConflict) {
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
  }, [profile, month, avails, blocks, appts, workingWeekdays, fullyBlockedDates, meetingType, city, stateUf, travelBufferMin, latitude, longitude, maxDistanceKm]);

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
  }, [selectedDate, avails, blocks, appts, meetingType, city, stateUf, travelBufferMin, latitude, longitude, maxDistanceKm]);

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
    if (meetingType === "presencial") {
      if (!address.trim()) {
        toast.error("Informe o endereço da reunião presencial");
        return;
      }
      if (!city.trim()) {
        toast.error("Informe a cidade da reunião presencial");
        return;
      }
      if (!stateUf.trim()) {
        toast.error("Selecione o estado (UF) da reunião presencial");
        return;
      }
    }
    setBusy(true);
    try {
      const clientId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { error: cErr } = await supabase
        .from("clients")
        .insert({
          id: clientId,
          name,
          company: company || null,
          email,
          phone: phone || null,
        });
      if (cErr) throw cErr;
      const { error: aErr } = await supabase.from("appointments").insert({
        representative_id: profile.id,
        client_id: clientId,
        appointment_date: format(selected.date, "yyyy-MM-dd"),
        start_time: selected.start,
        end_time: selected.end,
        notes: notes || null,
        meeting_type: meetingType,
        location: meetingType === "presencial" ? address.trim() : null,
        city: meetingType === "presencial" ? city.trim() : null,
        state: meetingType === "presencial" ? stateUf.trim().toUpperCase() : null,
        latitude: meetingType === "presencial" ? latitude : null,
        longitude: meetingType === "presencial" ? longitude : null,
      });
      if (aErr) throw aErr;
      setSuccess(true);
    } catch (e: unknown) {
      const msg =
        (typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "")
          : "") ||
        (e instanceof Error ? e.message : "") ||
        "Não foi possível concluir o agendamento. Tente novamente.";
      if (msg.includes("já reservado") || msg.includes("uniq_appointment")) {
        toast.error("Esse horário acabou de ser reservado. Escolha outro.");
        setSelected(null);
        // reload appointments for the month
        const start = format(startOfMonth(month), "yyyy-MM-dd");
        const end = format(endOfMonth(month), "yyyy-MM-dd");
        const { data } = await supabase
          .from("appointments")
          .select("appointment_date, start_time, end_time, meeting_type, city, state")
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
            Verifique o link recebido com o representante SETA.
          </p>
        </div>
      </div>
    );
  }

  if (success && selected) {
    const isPresencial = meetingType === "presencial";
    const calendarEvent: CalendarEvent = {
      title: `Reunião com ${profile.full_name} — SETA Embalagens`,
      description: `Reunião comercial ${isPresencial ? "presencial" : "online"} com ${profile.full_name}.${
        isPresencial && address ? `\n\nEndereço: ${address}` : ""
      }${notes ? `\n\nObservações: ${notes}` : ""}`,
      location: isPresencial ? address : undefined,
      date: format(selected.date, "yyyy-MM-dd"),
      startTime: selected.start,
      endTime: selected.end,
      organizerName: profile.full_name,
      attendeeEmail: email,
      attendeeName: name,
    };
    const googleUrl = calendarLib?.buildGoogleCalendarUrl(calendarEvent) ?? "#";
    const durationMin = Math.round(
      (parse(selected.end, "HH:mm:ss", selected.date).getTime() -
        parse(selected.start, "HH:mm:ss", selected.date).getTime()) /
        60000,
    );
    return (
      <div className="flex min-h-screen flex-col bg-secondary">
        <PublicHeader />
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            {/* Cabeçalho de sucesso com gradiente da marca */}
            <div
              className="px-6 py-8 text-center sm:px-10 sm:py-10"
              style={{ background: "var(--gradient-hero)" }}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-background/15 ring-4 ring-background/25 backdrop-blur">
                <CheckCircle2 className="h-9 w-9 text-primary-foreground" />
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/85">
                Agendamento confirmado
              </p>
              <h1 className="mt-2 text-2xl font-bold text-primary-foreground sm:text-3xl">
                Tudo certo, {name.split(" ")[0]}!
              </h1>
              <p className="mt-2 text-sm text-primary-foreground/85">
                Sua reunião comercial com a SETA Embalagens está agendada.
              </p>
            </div>

            {/* Resumo do agendamento */}
            <div className="px-6 py-6 sm:px-10 sm:py-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Resumo
              </p>

              <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-muted/20">
                <SummaryRow
                  label="Representante"
                  value={profile.full_name}
                />
                <SummaryRow
                  label="Data"
                  value={
                    <span className="capitalize">
                      {format(
                        selected.date,
                        "EEEE, dd 'de' MMMM 'de' yyyy",
                        { locale: ptBR },
                      )}
                    </span>
                  }
                />
                <SummaryRow
                  label="Horário"
                  value={`${selected.start.slice(0, 5)} – ${selected.end.slice(0, 5)} (${durationMin} min)`}
                />
                <SummaryRow
                  label="Modalidade"
                  value={isPresencial ? "Presencial" : "Online"}
                />
                {isPresencial && (city || stateUf) && (
                  <SummaryRow label="Cidade" value={`${city}${stateUf ? ` - ${stateUf}` : ""}`} />
                )}
                {isPresencial && address && (
                  <SummaryRow label="Endereço" value={address} />
                )}
                <SummaryRow label="Nome" value={name} />
                {company && <SummaryRow label="Empresa" value={company} />}
                <SummaryRow label="E-mail" value={email} />
                {phone && <SummaryRow label="Telefone" value={phone} />}
              </dl>

              {/* Mensagem para o cliente */}
              <div className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
                <p className="font-semibold text-primary">
                  O que acontece agora?
                </p>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li className="flex gap-2">
                    <span aria-hidden className="text-primary">•</span>
                    Enviamos uma confirmação para <strong className="text-foreground">{email}</strong>.
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden className="text-primary">•</span>
                    Adicione o compromisso à sua agenda usando os botões abaixo.
                  </li>
                  <li className="flex gap-2">
                    <span aria-hidden className="text-primary">•</span>
                    Em caso de imprevisto, responda o e-mail ou converse com o representante para reagendar com antecedência.
                  </li>
                </ul>
              </div>

              {/* Tutorial: adicionar à agenda do cliente (mesmo padrão usado pelo representante) */}
              <div className="mt-6">
                <ClientCalendarTutorial
                  calendarEvent={calendarEvent}
                  fileName={`reuniao-${format(selected.date, "yyyy-MM-dd")}.ics`}
                  calendarLib={calendarLib}
                  googleUrl={googleUrl}
                />
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Conheça mais a SETA em{" "}
            <a
              href="https://setaembalagens.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              setaembalagens.com.br
            </a>
          </p>
        </div>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {/* Rep card */}
        <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
          <div
            className="h-24 sm:h-32"
            style={{ background: "var(--gradient-hero)" }}
          />
          <CardContent className="-mt-14 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-end sm:p-8">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-28 w-28 rounded-full border-4 border-card object-cover shadow-md"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-card bg-secondary text-3xl font-bold text-primary shadow-md">
                {profile.full_name[0]}
              </div>
            )}
            <div className="pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                Agendar reunião com
              </p>
              <h1 className="mt-1.5 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {profile.full_name}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalIcon className="h-3.5 w-3.5" />
                Representante SETA Embalagens
              </p>
            </div>
          </CardContent>
          {profile.bio && (
            <div className="border-t bg-muted/30 px-6 py-4 sm:px-8">
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
            <CardContent className="p-6 sm:p-8">
              <div className="mb-6 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                    Confirme seus dados
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <CalIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="capitalize">
                      {format(selected.date, "EEEE, dd 'de' MMMM", {
                        locale: ptBR,
                      })}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    {selected.start.slice(0, 5)} – {selected.end.slice(0, 5)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border-2 border-primary/30 bg-background px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground sm:self-auto"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Trocar horário
                </button>
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
                {(() => {
                  const options = (["online", "presencial"] as const).filter(
                    (o) =>
                      (o === "online" && profile.allow_online) ||
                      (o === "presencial" && profile.allow_presencial),
                  );
                  if (options.length <= 1) {
                    const only = options[0] ?? "online";
                    return (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Modalidade da reunião</Label>
                        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium uppercase tracking-wide">
                          {only === "online" ? "Online" : "Presencial"}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Modalidade da reunião *</Label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-1">
                        {options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setMeetingType(opt)}
                            className={cn(
                              "rounded-md px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors",
                              meetingType === opt
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {opt === "online" ? "Online" : "Presencial"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {meetingType === "presencial" && (
                  <>
                    {(() => {
                      const region = selected ? dayRegion(format(selected.date, "yyyy-MM-dd")) : null;
                      if (!region) return null;
                      return (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
                          <strong>Atenção:</strong> a agenda do dia {format(selected.date, "dd/MM")} já tem uma visita presencial em <strong>{region.city} - {region.state.toUpperCase()}</strong>. Só é possível agendar dentro de um raio de <strong>{maxDistanceKm} km</strong> dessa visita {region.latitude != null && region.longitude != null ? "(use o botão de localização para validar)" : "(coordenadas não informadas — vale por cidade)"}.
                        </div>
                      );
                    })()}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>CEP</Label>
                      <div className="flex gap-2">
                        <Input
                          value={cep}
                          onChange={(e) => setCep(formatCep(e.target.value))}
                          onBlur={(e) => lookupCep(e.target.value)}
                          placeholder="00000-000"
                          inputMode="numeric"
                          maxLength={9}
                          className="max-w-[160px]"
                        />
                        <button
                          type="button"
                          onClick={() => lookupCep(cep)}
                          disabled={cepBusy || cep.replace(/\D/g, "").length !== 8}
                          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-60"
                        >
                          {cepBusy ? "Buscando…" : "Buscar CEP"}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Digite o CEP para preencher cidade, estado e rua automaticamente.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cidade *</Label>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Ex.: Joinville"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Estado (UF) *</Label>
                      <select
                        value={stateUf}
                        onChange={(e) => setStateUf(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Selecione…</option>
                        {UF_LIST.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Número</Label>
                      <Input
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        placeholder="Ex.: 123"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Complemento</Label>
                      <Input
                        value={addressComplement}
                        onChange={(e) => setAddressComplement(e.target.value)}
                        placeholder="Apto, bloco, sala…"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Endereço da reunião *</Label>
                      <Textarea
                        value={address}
                        onChange={(e) => { setAddress(e.target.value); setStreetBase(""); }}
                        placeholder="Rua, número, complemento, bairro"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">
                        Confira o endereço onde o representante deve comparecer. Para otimizar deslocamentos, o sistema mantém um intervalo de {Math.round(travelBufferMin / 60)}h entre visitas presenciais e só permite uma cidade por dia.
                      </p>
                    </div>

                    <div className="space-y-2 sm:col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Label className="text-sm">Localização precisa (opcional)</Label>
                          <p className="text-xs text-muted-foreground">
                            Use sua localização atual ou escolha um ponto no mapa para o representante encontrar com facilidade.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={requestGeolocation}
                            disabled={geoBusy}
                            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-60"
                          >
                            📍 {geoBusy ? "Capturando…" : latitude !== null ? "Atualizar atual" : "Usar atual"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setMapPickerOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                          >
                            🗺️ Escolher no mapa
                          </button>
                        </div>
                      </div>
                      {latitude !== null && longitude !== null && (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">
                            {latitude.toFixed(6)}, {longitude.toFixed(6)}
                          </span>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              Ver no mapa
                            </a>
                            <button
                              type="button"
                              onClick={() => { setLatitude(null); setLongitude(null); }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Conte sobre o que pretende discutir…"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-sm transition-all hover:bg-primary-hover hover:shadow-md disabled:opacity-60"
              >
                {busy ? "Confirmando…" : "Confirmar agendamento"}
              </button>
            </CardContent>
          </Card>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground sm:text-right">
        {value}
      </dd>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-8">
        <a
          href="https://setaembalagens.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center transition-opacity hover:opacity-80"
          aria-label="SETA Embalagens — site institucional"
        >
          <SetaLogo variant="dark" className="h-12 w-auto sm:h-14" />
        </a>
        <div className="flex items-center gap-4 sm:gap-8">
          <span className="hidden text-[13px] font-semibold uppercase tracking-[0.22em] text-primary md:inline">
            Agendamento Comercial
          </span>
          <a
            href="https://setaembalagens.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-sm transition-all hover:bg-primary-hover hover:shadow-md sm:px-6 sm:text-sm"
          >
            Voltar ao site
          </a>
        </div>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="mt-12 border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:px-8 sm:text-left">
        <div className="flex items-center gap-3">
          <SetaLogo variant="dark" className="h-9 w-auto" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Embalagens
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} SETA Embalagens — Produzimos embalagens, entregamos confiança.
        </p>
        <a
          href="https://setaembalagens.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary hover:text-primary-hover"
        >
          setaembalagens.com.br
        </a>
      </div>
    </footer>
  );
}

function BookingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <PublicHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)]">
          <Skeleton className="h-24 w-full sm:h-32" />
          <CardContent className="-mt-14 flex items-end gap-4 p-6 sm:p-8">
            <Skeleton className="h-28 w-28 rounded-full" />
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
      <PublicFooter />
    </div>
  );
}
