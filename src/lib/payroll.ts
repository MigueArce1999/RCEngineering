/**
 * Cálculos de nómina de obra. Total por trabajador = días × valor día + extras − descuentos.
 * No incluye aportes a seguridad social ni prestaciones (se liquidan aparte).
 */
import type { PayrollEntry, PayrollKind, PayrollPeriod } from "@/types";
import { formatCOP, parseISODate, todayISO } from "./format";

export const WORKER_ROLES = ["Ayudante / Obrero", "Oficial", "Maestro de obra", "Almacenista", "Operador de equipo", "Conductor", "Vigilante", "Otro"];

export const KIND_LABEL: Record<PayrollKind, string> = { biweekly: "Quincenal", monthly: "Mensual" };

export const entrySubtotal = (e: Pick<PayrollEntry, "days" | "dailyRate">) => Math.round(Math.max(0, e.days) * Math.max(0, e.dailyRate));
export const entryTotal = (e: PayrollEntry) => entrySubtotal(e) + Math.max(0, e.extras) - Math.max(0, e.deductions);

export function periodSummary(entries: PayrollEntry[]) {
  const byRole = new Map<string, { role: string; workers: number; days: number; total: number }>();
  let days = 0;
  let subtotal = 0;
  let extras = 0;
  let deductions = 0;
  for (const e of entries) {
    days += e.days;
    subtotal += entrySubtotal(e);
    extras += e.extras;
    deductions += e.deductions;
    const r = byRole.get(e.role) ?? { role: e.role, workers: 0, days: 0, total: 0 };
    r.workers += 1;
    r.days += e.days;
    r.total += entryTotal(e);
    byRole.set(e.role, r);
  }
  return { days, subtotal, extras, deductions, total: subtotal + extras - deductions, byRole: [...byRole.values()].sort((a, b) => b.total - a.total) };
}

const iso = (d: Date) => todayISO(d);

/** Rango del periodo que contiene la fecha: quincena 1–15 / 16–fin de mes, o el mes completo. */
export function periodRange(kind: PayrollKind, dateISO: string) {
  const d = parseISODate(dateISO);
  const y = d.getFullYear();
  const m = d.getMonth();
  const last = new Date(y, m + 1, 0);
  if (kind === "monthly") return { start: iso(new Date(y, m, 1)), end: iso(last) };
  return d.getDate() <= 15 ? { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m, 15)) } : { start: iso(new Date(y, m, 16)), end: iso(last) };
}

/** Días calendario del periodo (referencia para el máximo de días trabajados). */
export const periodDays = (p: Pick<PayrollPeriod, "startDate" | "endDate">) =>
  Math.round((parseISODate(p.endDate).getTime() - parseISODate(p.startDate).getTime()) / 86_400_000) + 1;

const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
export function periodTitle(p: Pick<PayrollPeriod, "kind" | "startDate" | "endDate">) {
  const s = parseISODate(p.startDate);
  const month = monthFmt.format(s);
  if (p.kind === "monthly") return `Mes de ${month}`;
  return `${s.getDate() <= 15 ? "1.ª" : "2.ª"} quincena de ${month}`;
}

/** CSV con separador ";" (abre directo en Excel en español). */
export function payrollCSV(p: PayrollPeriod, projectName: string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [
    ["Proyecto", projectName],
    ["Periodo", `${periodTitle(p)} (${p.startDate} a ${p.endDate})`],
    [],
    ["Trabajador", "Cargo", "Días", "Valor día", "Subtotal", "Extras", "Descuentos", "Total a pagar"],
    ...p.entries.map((e) => [e.workerName, e.role, e.days, e.dailyRate, entrySubtotal(e), e.extras, e.deductions, entryTotal(e)]),
  ];
  const s = periodSummary(p.entries);
  rows.push([], ["Totales", "", s.days, "", s.subtotal, s.extras, s.deductions, s.total]);
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}

export const moneyHint = (n: number) => (n ? formatCOP(n) : "");
