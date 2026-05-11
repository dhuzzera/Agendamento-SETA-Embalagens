// Feriados nacionais brasileiros.
// Combina datas fixas (CLT/Lei 10.607) com datas móveis derivadas da Páscoa
// (Carnaval, Sexta-Feira Santa, Corpus Christi).

export type Holiday = { date: string; name: string };

// Algoritmo de Meeus/Jones/Butcher para cálculo do Domingo de Páscoa.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function brazilianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    { date: `${year}-01-01`, name: "Confraternização Universal" },
    { date: fmt(addDays(easter, -48)), name: "Carnaval (segunda)" },
    { date: fmt(addDays(easter, -47)), name: "Carnaval (terça)" },
    { date: fmt(addDays(easter, -2)), name: "Sexta-feira Santa" },
    { date: `${year}-04-21`, name: "Tiradentes" },
    { date: `${year}-05-01`, name: "Dia do Trabalho" },
    { date: fmt(addDays(easter, 60)), name: "Corpus Christi" },
    { date: `${year}-09-07`, name: "Independência do Brasil" },
    { date: `${year}-10-12`, name: "Nossa Senhora Aparecida" },
    { date: `${year}-11-02`, name: "Finados" },
    { date: `${year}-11-15`, name: "Proclamação da República" },
    { date: `${year}-11-20`, name: "Consciência Negra" },
    { date: `${year}-12-25`, name: "Natal" },
  ];
}

// Retorna feriados nacionais em um intervalo de datas (inclusive).
export function holidaysBetween(from: Date, to: Date): Holiday[] {
  const result: Holiday[] = [];
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
    for (const h of brazilianHolidays(y)) {
      const d = new Date(`${h.date}T00:00:00`);
      if (d >= from && d <= to) result.push(h);
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
