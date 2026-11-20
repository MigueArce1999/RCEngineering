/** Acceso a datos de nómina (tablas workers, payroll_periods, payroll_entries; RLS: payroll.manage). */
import type { PayrollEntry, PayrollPeriod, Worker } from "@/types";
import { supabase } from "./supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function db() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}
function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
function affected(res: { data: Row[] | null; error: { message: string } | null }) {
  const rows = check<Row[]>(res);
  if (!rows?.length) throw new Error("Tu rol no tiene permiso para gestionar la nómina.");
  return rows;
}

const toWorker = (r: Row): Worker => ({ id: r.id, projectId: r.project_id, name: r.name, document: r.document, role: r.role, dailyRate: Number(r.daily_rate), active: r.active });
const toEntry = (r: Row): PayrollEntry => ({
  id: r.id,
  workerId: r.worker_id,
  workerName: r.worker_name,
  role: r.role,
  days: Number(r.days),
  dailyRate: Number(r.daily_rate),
  extras: Number(r.extras),
  deductions: Number(r.deductions),
});

export async function loadPayroll(projectId: string): Promise<{ workers: Worker[]; periods: PayrollPeriod[] }> {
  const c = db();
  const [w, p] = await Promise.all([
    c.from("workers").select("*").eq("project_id", projectId).order("name").then(check<Row[]>),
    c.from("payroll_periods").select("*, payroll_entries(*)").eq("project_id", projectId).order("start_date", { ascending: false }).then(check<Row[]>),
  ]);
  return {
    workers: w.map(toWorker),
    periods: p.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      kind: r.kind,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      paidAt: r.paid_at,
      expenseId: r.expense_id,
      notes: r.notes,
      entries: [...(r.payroll_entries ?? [])].sort((a: Row, b: Row) => a.sort_order - b.sort_order).map(toEntry),
    })),
  };
}

export async function upsertWorker(w: Worker) {
  affected(await db().from("workers").upsert({ id: w.id, project_id: w.projectId, name: w.name, document: w.document, role: w.role, daily_rate: w.dailyRate, active: w.active }).select("id"));
}

export async function deleteWorker(id: string) {
  affected(await db().from("workers").delete().eq("id", id).select("id"));
}

export async function createPeriod(p: PayrollPeriod) {
  affected(await db().from("payroll_periods").insert({ id: p.id, project_id: p.projectId, kind: p.kind, start_date: p.startDate, end_date: p.endDate, notes: p.notes }).select("id"));
  await saveEntries(p.id, p.entries);
}

/**
 * Guarda las líneas del periodo: actualiza/inserta las actuales y elimina las que se quitaron.
 * Idempotente (por id), así varios guardados automáticos seguidos no se pisan ni duplican filas.
 */
export async function saveEntries(periodId: string, entries: PayrollEntry[]) {
  if (entries.length)
    check(
      await db()
        .from("payroll_entries")
        .upsert(entries.map((e, i) => ({ id: e.id, period_id: periodId, worker_id: e.workerId, worker_name: e.workerName, role: e.role, days: e.days, daily_rate: e.dailyRate, extras: e.extras, deductions: e.deductions, sort_order: i })))
        .select("id"),
    );
  let del = db().from("payroll_entries").delete().eq("period_id", periodId);
  if (entries.length) del = del.not("id", "in", `(${entries.map((e) => `"${e.id}"`).join(",")})`);
  check(await del.select("id"));
}

export async function deletePeriod(id: string) {
  affected(await db().from("payroll_periods").delete().eq("id", id).select("id"));
}

/** Marca el periodo como pagado y registra el gasto de mano de obra en Finanzas. */
export async function payPeriod(p: PayrollPeriod, total: number, concept: string, paidAt: string, expenseId: string) {
  affected(await db().from("expenses").insert({ id: expenseId, project_id: p.projectId, date: paidAt, concept, category: "labor", amount: total }).select("id"));
  affected(await db().from("payroll_periods").update({ status: "paid", paid_at: paidAt, expense_id: expenseId }).eq("id", p.id).select("id"));
}

/** Reabre el periodo y elimina el gasto que se había registrado. */
export async function reopenPeriod(p: PayrollPeriod) {
  affected(await db().from("payroll_periods").update({ status: "draft", paid_at: null, expense_id: null }).eq("id", p.id).select("id"));
  if (p.expenseId) check(await db().from("expenses").delete().eq("id", p.expenseId).select("id"));
}
