/**
 * Testes unitários para a lógica de cálculo de slots e buffer de deslocamento.
 * Extrai e testa as funções críticas do PublicBooking de forma isolada.
 */
import { describe, it, expect } from "vitest";
import { addMinutes, format, parse } from "date-fns";

// ─── Helpers replicados do PublicBooking ────────────────────────────────────

const addMinToHHMMSS = (t: string, mins: number): string => {
  const [h, m, s] = t.split(":").map((v) => parseInt(v, 10));
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${String(s ?? 0).padStart(2, "0")}`;
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

type Avail = { weekday: number; start_time: string; end_time: string; meeting_duration_min: number };
type Block = { block_date: string; start_time: string | null; end_time: string | null };
type Appt = {
  appointment_date: string;
  start_time: string;
  end_time: string;
  meeting_type: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

function slotsFor(
  day: Date,
  avails: Avail[],
  blocks: Block[],
  appts: Appt[],
  meetingType: "online" | "presencial",
  city: string,
  stateUf: string,
  travelBufferMin: number,
  maxDistanceKm: number,
  latitude: number | null,
  longitude: number | null,
): { start: string; end: string }[] {
  const wd = day.getDay();
  const dayAvails = avails.filter((a) => a.weekday === wd);
  if (dayAvails.length === 0) return [];
  const dateStr = format(day, "yyyy-MM-dd");
  const dayBlocks = blocks.filter((b) => b.block_date === dateStr);
  const fullDayBlocked = dayBlocks.some((b) => !b.start_time && !b.end_time);
  if (fullDayBlocked) return [];
  const dayAppts = appts.filter((a) => a.appointment_date === dateStr);

  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

  if (meetingType === "presencial") {
    const presenciais = dayAppts
      .filter((a) => a.meeting_type === "presencial" && a.city && a.state)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (presenciais.length > 0) {
      const first = presenciais[0];
      if (
        first.latitude != null &&
        first.longitude != null &&
        latitude != null &&
        longitude != null
      ) {
        const dist = haversineKm(first.latitude, first.longitude, latitude, longitude);
        if (dist > maxDistanceKm) return [];
      } else if (
        norm(first.city) !== norm(city) ||
        norm(first.state) !== norm(stateUf)
      ) {
        return [];
      }
    }
  }

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
    while (endTime >= addMinutes(cur, a.meeting_duration_min)) {
      const slotEnd = addMinutes(cur, a.meeting_duration_min);
      const sStr = format(cur, "HH:mm:ss");
      const eStr = format(slotEnd, "HH:mm:ss");
      const blocked = dayBlocks.some(
        (b) => b.start_time && b.end_time && sStr < b.end_time && eStr > b.start_time,
      );
      const taken = dayAppts.some((ap) => sStr < ap.end_time && eStr > ap.start_time);
      const travelConflict = presBuffers.some((b) => sStr < b.end && eStr > b.start);
      if (!blocked && !taken && !travelConflict) {
        slots.push({ start: sStr, end: eStr });
      }
      cur = slotEnd;
    }
  }
  return slots;
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

// Segunda-feira (weekday = 1), 09:00–12:00, reuniões de 30 min
const AVAIL_MON: Avail = {
  weekday: 1,
  start_time: "09:00:00",
  end_time: "12:00:00",
  meeting_duration_min: 30,
};

// Uma segunda-feira fixa para os testes (sem horário passado)
const MONDAY = new Date(2030, 0, 7); // 07/01/2030 = segunda

// ─── Testes ─────────────────────────────────────────────────────────────────

describe("addMinToHHMMSS", () => {
  it("adiciona minutos corretamente", () => {
    expect(addMinToHHMMSS("09:00:00", 30)).toBe("09:30:00");
    expect(addMinToHHMMSS("09:00:00", 60)).toBe("10:00:00");
    expect(addMinToHHMMSS("23:30:00", 60)).toBe("00:30:00");
  });

  it("subtrai minutos (valor negativo)", () => {
    expect(addMinToHHMMSS("10:00:00", -30)).toBe("09:30:00");
    expect(addMinToHHMMSS("09:00:00", -60)).toBe("08:00:00");
  });
});

describe("haversineKm", () => {
  it("retorna 0 para o mesmo ponto", () => {
    expect(haversineKm(-26.3, -48.8, -26.3, -48.8)).toBeCloseTo(0, 5);
  });

  it("calcula distância Joinville–Florianópolis (~130 km)", () => {
    const dist = haversineKm(-26.3, -48.8, -27.6, -48.5);
    expect(dist).toBeGreaterThan(120);
    expect(dist).toBeLessThan(150);
  });

  it("detecta pontos dentro do raio de 30 km", () => {
    // ~5 km de diferença
    const dist = haversineKm(-26.3, -48.8, -26.35, -48.85);
    expect(dist).toBeLessThan(30);
  });
});

describe("slotsFor — sem conflitos", () => {
  it("gera 6 slots de 30 min entre 09:00 e 12:00", () => {
    const slots = slotsFor(MONDAY, [AVAIL_MON], [], [], "online", "", "", 180, 30, null, null);
    expect(slots).toHaveLength(6);
    expect(slots[0]).toEqual({ start: "09:00:00", end: "09:30:00" });
    expect(slots[5]).toEqual({ start: "11:30:00", end: "12:00:00" });
  });

  it("retorna vazio quando não há disponibilidade no dia", () => {
    // AVAIL_MON é segunda (1), MONDAY é segunda — mas testamos com terça (2)
    const TUESDAY = new Date(2030, 0, 8);
    const slots = slotsFor(TUESDAY, [AVAIL_MON], [], [], "online", "", "", 180, 30, null, null);
    expect(slots).toHaveLength(0);
  });
});

describe("slotsFor — bloqueios", () => {
  it("remove slots cobertos por bloqueio parcial", () => {
    const block: Block = {
      block_date: "2030-01-07",
      start_time: "09:00:00",
      end_time: "10:30:00",
    };
    const slots = slotsFor(MONDAY, [AVAIL_MON], [block], [], "online", "", "", 180, 30, null, null);
    // 09:00, 09:30, 10:00 bloqueados → restam 10:30, 11:00, 11:30
    expect(slots).toHaveLength(3);
    expect(slots[0].start).toBe("10:30:00");
  });

  it("retorna vazio quando o dia inteiro está bloqueado", () => {
    const block: Block = { block_date: "2030-01-07", start_time: null, end_time: null };
    const slots = slotsFor(MONDAY, [AVAIL_MON], [block], [], "online", "", "", 180, 30, null, null);
    expect(slots).toHaveLength(0);
  });
});

describe("slotsFor — agendamentos existentes", () => {
  it("remove slot já ocupado", () => {
    const appt: Appt = {
      appointment_date: "2030-01-07",
      start_time: "09:00:00",
      end_time: "09:30:00",
      meeting_type: "online",
      city: null,
      state: null,
      latitude: null,
      longitude: null,
    };
    const slots = slotsFor(MONDAY, [AVAIL_MON], [], [appt], "online", "", "", 180, 30, null, null);
    expect(slots).toHaveLength(5);
    expect(slots.find((s) => s.start === "09:00:00")).toBeUndefined();
  });
});

describe("slotsFor — buffer de deslocamento presencial", () => {
  const presAppt: Appt = {
    appointment_date: "2030-01-07",
    start_time: "10:00:00",
    end_time: "10:30:00",
    meeting_type: "presencial",
    city: "Joinville",
    state: "SC",
    latitude: null,
    longitude: null,
  };

  it("bloqueia slots dentro do buffer de 60 min antes e depois", () => {
    // Buffer de 60 min: bloqueia 09:00–11:30
    const slots = slotsFor(
      MONDAY, [AVAIL_MON], [], [presAppt],
      "presencial", "Joinville", "SC",
      60, 30, null, null,
    );
    // 09:00 (fim 09:30) conflita com buffer 09:00–11:30
    // 09:30 (fim 10:00) conflita
    // 10:00 (fim 10:30) conflita (taken)
    // 10:30 (fim 11:00) conflita com buffer até 11:30
    // 11:00 (fim 11:30) conflita
    // 11:30 (fim 12:00) livre
    expect(slots).toHaveLength(1);
    expect(slots[0].start).toBe("11:30:00");
  });

  it("bloqueia todos os slots com buffer de 180 min (padrão)", () => {
    const slots = slotsFor(
      MONDAY, [AVAIL_MON], [], [presAppt],
      "presencial", "Joinville", "SC",
      180, 30, null, null,
    );
    expect(slots).toHaveLength(0);
  });
});

describe("slotsFor — restrição de região presencial", () => {
  const presAppt: Appt = {
    appointment_date: "2030-01-07",
    start_time: "09:00:00",
    end_time: "09:30:00",
    meeting_type: "presencial",
    city: "Joinville",
    state: "SC",
    latitude: null,
    longitude: null,
  };

  it("retorna vazio quando cidade é diferente da região do dia", () => {
    const slots = slotsFor(
      MONDAY, [AVAIL_MON], [], [presAppt],
      "presencial", "Florianópolis", "SC",
      0, 30, null, null,
    );
    expect(slots).toHaveLength(0);
  });

  it("retorna slots quando cidade é a mesma da região do dia", () => {
    const slots = slotsFor(
      MONDAY, [AVAIL_MON], [], [presAppt],
      "presencial", "Joinville", "SC",
      0, 30, null, null,
    );
    // presAppt ocupa 09:00–09:30, restam 5 slots
    expect(slots).toHaveLength(5);
  });

  it("retorna vazio quando distância GPS excede o raio máximo", () => {
    const apptWithGps: Appt = {
      ...presAppt,
      latitude: -26.3,
      longitude: -48.8, // Joinville
    };
    const slots = slotsFor(
      MONDAY, [AVAIL_MON], [], [apptWithGps],
      "presencial", "", "",
      0, 30,
      -27.6, -48.5, // Florianópolis (~130 km)
    );
    expect(slots).toHaveLength(0);
  });

  it("retorna slots quando distância GPS está dentro do raio", () => {
    const apptWithGps: Appt = {
      ...presAppt,
      latitude: -26.3,
      longitude: -48.8,
    };
    const slots = slotsFor(
      MONDAY, [AVAIL_MON], [], [apptWithGps],
      "presencial", "", "",
      0, 30,
      -26.31, -48.81, // ~1.5 km de distância
    );
    expect(slots).toHaveLength(5);
  });
});
