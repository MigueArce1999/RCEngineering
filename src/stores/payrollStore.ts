"use client";

import { create } from "zustand";
import type { PayrollEntry, PayrollKind, PayrollPeriod, Worker } from "@/types";
import * as api from "@/lib/payrollApi";
import { periodRange, periodSummary, periodTitle } from "@/lib/payroll";
import { todayISO, uid } from "@/lib/format";
import { can } from "./authStore";
import { useProjectStore } from "./projectStore";
import { useUI } from "./uiStore";

/** Estado de nómina del proyecto activo. Se carga solo al abrir el módulo (datos sensibles). */
interface PayrollState {
  projectId: string | null;
  workers: Worker[];
  periods: PayrollPeriod[];
  state: "idle" | "loading" | "ready" | "error";
  error: string | null;
  load: () => Promise<void>;
  saveWorker: (w: Omit<Worker, "id" | "projectId"> & { id?: string }) => Promise<boolean>;
  removeWorker: (id: string) => Promise<boolean>;
  createPeriod: (kind: PayrollKind, dateISO: string) => Promise<string | null>;
  saveEntries: (periodId: string, entries: PayrollEntry[]) => Promise<boolean>;
  removePeriod: (id: string) => Promise<boolean>;
  pay: (periodId: string, paidAt: string) => Promise<boolean>;
  reopen: (periodId: string) => Promise<boolean>;
}

const toast = (title: string, description?: string, tone: "success" | "info" | "warning" = "success") => useUI.getState().toast({ title, description, tone });

async function run(label: string, op: () => Promise<unknown>) {
  if (!can("payroll.manage")) {
    toast("Tu rol no permite gestionar la nómina", "Pide acceso a un administrador.", "info");
    return false;
  }
  try {
    await op();
    return true;
  } catch (e) {
    toast(`No se pudo guardar: ${label}`, (e as Error).message, "warning");
    return false;
  }
}

let inflight: { projectId: string; promise: Promise<void> } | null = null;

export const usePayroll = create<PayrollState>()((set, get) => ({
  projectId: null,
  workers: [],
  periods: [],
  state: "idle",
  error: null,

  load: () => {
    const projectId = useProjectStore.getState().projectId;
    if (!projectId || !can("payroll.manage")) return Promise.resolve();
    // Una sola petición a la vez por proyecto (precarga + apertura no duplican)
    if (inflight && inflight.projectId === projectId) return inflight.promise;
    // Con datos del mismo proyecto se muestran al instante y se actualizan en segundo plano
    if (get().projectId !== projectId) set({ projectId, workers: [], periods: [], state: "loading" });
    const promise = api
      .loadPayroll(projectId)
      .then((data) => {
        if (useProjectStore.getState().projectId === projectId) set({ ...data, state: "ready", error: null });
      })
      .catch((e: Error) => {
        if (get().state !== "ready") set({ state: "error", error: e.message });
      })
      .finally(() => {
        if (inflight?.promise === promise) inflight = null;
      });
    inflight = { projectId, promise };
    return promise;
  },

  saveWorker: async (input) => {
    const projectId = get().projectId!;
    const w: Worker = { id: input.id ?? uid("wrk"), projectId, name: input.name.trim(), document: input.document.trim(), role: input.role, dailyRate: Math.round(input.dailyRate), active: input.active };
    const ok = await run("trabajador", () => api.upsertWorker(w));
    if (ok) set((s) => ({ workers: [...s.workers.filter((x) => x.id !== w.id), w].sort((a, b) => a.name.localeCompare(b.name)) }));
    return ok;
  },

  removeWorker: async (id) => {
    const ok = await run("trabajador", () => api.deleteWorker(id));
    if (ok) set((s) => ({ workers: s.workers.filter((w) => w.id !== id) }));
    return ok;
  },

  createPeriod: async (kind, dateISO) => {
    const { start, end } = periodRange(kind, dateISO);
    if (get().periods.some((p) => p.kind === kind && p.startDate === start)) {
      toast("Ese periodo ya existe", `${kind === "monthly" ? "Mes" : "Quincena"} que inicia el ${start}`, "info");
      return null;
    }
    const projectId = get().projectId!;
    // Se precarga una línea por cada trabajador activo con su valor día; los días se diligencian luego
    const entries: PayrollEntry[] = get()
      .workers.filter((w) => w.active)
      .map((w) => ({ id: uid("pye"), workerId: w.id, workerName: w.name, role: w.role, days: 0, dailyRate: w.dailyRate, extras: 0, deductions: 0 }));
    const p: PayrollPeriod = { id: uid("pyp"), projectId, kind, startDate: start, endDate: end, status: "draft", paidAt: null, expenseId: null, notes: "", entries };
    const ok = await run("periodo", () => api.createPeriod(p));
    if (!ok) return null;
    set((s) => ({ periods: [p, ...s.periods].sort((a, b) => b.startDate.localeCompare(a.startDate)) }));
    return p.id;
  },

  saveEntries: async (periodId, entries) => {
    const ok = await run("liquidación", () => api.saveEntries(periodId, entries));
    if (ok) set((s) => ({ periods: s.periods.map((p) => (p.id === periodId ? { ...p, entries } : p)) }));
    return ok;
  },

  removePeriod: async (id) => {
    const ok = await run("periodo", () => api.deletePeriod(id));
    if (ok) set((s) => ({ periods: s.periods.filter((p) => p.id !== id) }));
    return ok;
  },

  pay: async (periodId, paidAt) => {
    const p = get().periods.find((x) => x.id === periodId);
    if (!p) return false;
    const total = periodSummary(p.entries).total;
    if (total <= 0) {
      toast("La nómina está en cero", "Diligencia los días trabajados antes de pagar.", "info");
      return false;
    }
    const expenseId = uid("exp");
    const ok = await run("pago de nómina", () => api.payPeriod(p, total, `Nómina · ${periodTitle(p)}`, paidAt || todayISO(), expenseId));
    if (ok) {
      set((s) => ({ periods: s.periods.map((x) => (x.id === periodId ? { ...x, status: "paid", paidAt, expenseId } : x)) }));
      // Finanzas refleja el gasto de inmediato
      void useProjectStore.getState().load();
    }
    return ok;
  },

  reopen: async (periodId) => {
    const p = get().periods.find((x) => x.id === periodId);
    if (!p) return false;
    const ok = await run("periodo", () => api.reopenPeriod(p));
    if (ok) {
      set((s) => ({ periods: s.periods.map((x) => (x.id === periodId ? { ...x, status: "draft", paidAt: null, expenseId: null } : x)) }));
      void useProjectStore.getState().load();
    }
    return ok;
  },
}));
