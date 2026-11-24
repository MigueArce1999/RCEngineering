/**
 * Valor ganado (EVM). Tres curvas sobre el mismo eje de dinero:
 *  · PV (valor planeado): lo que debería llevar ejecutado según el cronograma.
 *  · EV (valor ganado): lo que vale el trabajo realmente hecho = avance real × presupuesto base.
 *  · AC (costo real): lo que se ha gastado.
 */
import type { Expense } from "@/types";
import { isOpening } from "./financeUi";
import { parseISODate, todayISO } from "./format";

export interface ProgressPoint {
  date: string;
  pct: number;
}

export interface EvmPoint {
  t: number;
  date: string;
  pv: number;
  ev: number | null;
  ac: number | null;
  /** Proyección del costo si el rendimiento actual se mantiene (solo desde hoy) */
  forecast: number | null;
}

export interface EvmMetrics {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  pct: number;
  /** Variación de costo = EV − AC (negativo: se gasta más de lo que vale lo construido) */
  cv: number;
  /** Variación de cronograma = EV − PV (negativo: atraso) */
  sv: number;
  cpi: number | null;
  spi: number | null;
  /** Estimado al terminar: BAC / CPI */
  eac: number | null;
  etc: number | null;
  /** Variación al terminar: BAC − EAC (negativo: sobrecosto proyectado) */
  vac: number | null;
}

const DAY = 86400000;
const ts = (iso: string) => parseISODate(iso).getTime();
const iso = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Avance (0–1) a una fecha: interpolación lineal entre registros; antes del primero, desde 0 en el inicio. */
export function progressAt(points: ProgressPoint[], date: string, start: string) {
  const pts = [{ date: start, pct: 0 }, ...[...points].sort((a, b) => a.date.localeCompare(b.date)).filter((p) => p.date > start)];
  const t = ts(date);
  if (t <= ts(pts[0].date)) return pts[0].pct;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (t <= ts(b.date)) {
      const span = ts(b.date) - ts(a.date);
      return span ? a.pct + ((t - ts(a.date)) / span) * (b.pct - a.pct) : b.pct;
    }
  }
  return pts[pts.length - 1].pct;
}

/** Valor planeado a una fecha: curva planeada del proyecto, o lineal entre inicio y entrega. */
export function plannedValue(curve: { date: string; amount: number }[], date: string, start: string, end: string, bac: number) {
  const t = ts(date);
  if (curve.length >= 2) {
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1];
      const b = curve[i];
      if (t <= ts(b.date)) {
        if (t <= ts(a.date)) return a.amount;
        return a.amount + ((t - ts(a.date)) / (ts(b.date) - ts(a.date))) * (b.amount - a.amount);
      }
    }
    return curve[curve.length - 1].amount;
  }
  const span = ts(end) - ts(start) || 1;
  return bac * Math.min(1, Math.max(0, (t - ts(start)) / span));
}

/** Gastado hasta una fecha (solo gastos que cuentan). El consumo previo, sin fecha real, se reparte parejo hasta hoy. */
export function spentAt(expenses: Expense[], d: string, today: string) {
  return expenses.reduce((sum, e) => {
    if (e.counts === false) return sum;
    if (isOpening(e)) {
      const span = ts(today) - ts(e.date);
      return sum + (span > 0 ? e.amount * Math.min(1, Math.max(0, (ts(d) - ts(e.date)) / span)) : d >= e.date ? e.amount : 0);
    }
    return e.date <= d ? sum + e.amount : sum;
  }, 0);
}

/** Eje de dinero compacto: "342 M" (sin signo ni salto de línea) */
export const axisM = (v: number) => (Math.abs(v) >= 10_000_000 ? `${Math.round(v / 1e6)} M` : `${(v / 1e6).toFixed(1).replace(".", ",")} M`);
/** Fecha corta de eje: "24 nov" */
export const axisDate = (t: number) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(t)).replace(".", "");

export function computeEvm(input: {
  bac: number;
  start: string;
  end: string;
  curve: { date: string; amount: number }[];
  expenses: Expense[];
  progress: ProgressPoint[];
  today?: string;
}): { series: EvmPoint[]; metrics: EvmMetrics | null } {
  const { bac, start, end, curve, progress } = input;
  const today = input.today ?? todayISO();
  if (!bac || !progress.length) return { series: [], metrics: null };
  const counted = input.expenses.filter((e) => e.counts !== false).sort((a, b) => a.date.localeCompare(b.date));
  const acAt = (d: string) => spentAt(counted, d, today);

  // Puntos de la serie: cada semana + fechas de registros y hoy
  const horizon = Math.max(ts(end), ts(today));
  const dates = new Set<string>([start, today, end]);
  for (let t = ts(start); t <= horizon; t += 7 * DAY) dates.add(iso(t));
  progress.forEach((p) => dates.add(p.date));
  const sorted = [...dates].filter((d) => d >= start).sort();

  const ev = (d: string) => progressAt(progress, d, start) * bac;
  const evToday = ev(today);
  const acToday = acAt(today);
  const cpi = acToday > 0 ? evToday / acToday : null;
  const eac = cpi && cpi > 0 ? bac / cpi : null;

  const series: EvmPoint[] = sorted.map((d) => {
    const past = d <= today;
    let forecast: number | null = null;
    if (eac !== null && d >= today) {
      const span = ts(end) - ts(today);
      // Del costo de hoy al estimado al terminar, linealmente hacia la fecha de entrega
      forecast = d >= end || span <= 0 ? eac : acToday + ((ts(d) - ts(today)) / span) * (eac - acToday);
    }
    return { t: ts(d), date: d, pv: plannedValue(curve, d, start, end, bac), ev: past ? ev(d) : null, ac: past ? acAt(d) : null, forecast };
  });

  const pv = plannedValue(curve, today, start, end, bac);
  const metrics: EvmMetrics = {
    bac,
    pv,
    ev: evToday,
    ac: acToday,
    pct: evToday / bac,
    cv: evToday - acToday,
    sv: evToday - pv,
    cpi,
    spi: pv > 0 ? evToday / pv : null,
    eac,
    etc: eac !== null ? Math.max(0, eac - acToday) : null,
    vac: eac !== null ? bac - eac : null,
  };
  return { series, metrics };
}

export type EvmTone = "good" | "watch" | "bad" | "none";
/** Semáforo de un índice (1,0 = en línea con el plan). */
export const indexTone = (v: number | null): EvmTone => (v === null ? "none" : v >= 0.97 ? "good" : v >= 0.85 ? "watch" : "bad");
