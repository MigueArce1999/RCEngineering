/**
 * Lógica de negocio pura (sin React). Todo indicador visible del dashboard se deriva de aquí,
 * de modo que barras, porcentajes y totales nunca se desconecten de los datos.
 */
import type {
  ConstructionStage,
  CostCategory,
  Expense,
  FinancialSummary,
  InventoryItem,
  InventoryMovement,
  Material,
  ModelElement,
  Quote,
  QuoteAdjustments,
  QuoteItem,
  StageStatus,
  Task,
} from "@/types";
import { parseISODate } from "./format";

// ── Avance físico ───────────────────────────────────────────────────────
export interface StageProgress {
  total: number;
  done: number;
  inProgress: number;
  pending: number;
  /** fracción 0–1 */
  progress: number;
  status: StageStatus;
}

export function stageProgress(stageId: string, tasks: Task[]): StageProgress {
  let total = 0;
  let done = 0;
  let inProgress = 0;
  for (const t of tasks) {
    if (t.stageId !== stageId) continue;
    total++;
    if (t.status === "done") done++;
    else if (t.status === "in_progress") inProgress++;
  }
  const progress = total ? done / total : 0;
  const status: StageStatus = total > 0 && done === total ? "completed" : done > 0 || inProgress > 0 ? "in_progress" : "pending";
  return { total, done, inProgress, pending: total - done, progress, status };
}

/** Avance físico general ponderado por el peso de cada etapa. */
export function overallProgress(stages: ConstructionStage[], tasks: Task[]) {
  const weightSum = stages.reduce((s, st) => s + st.weight, 0) || 1;
  return stages.reduce((acc, st) => acc + (st.weight / weightSum) * stageProgress(st.id, tasks).progress, 0);
}

/** Etapa actual: la primera (en orden) que no está completada. */
export function currentStage(stages: ConstructionStage[], tasks: Task[]) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  return sorted.find((s) => stageProgress(s.id, tasks).status !== "completed") ?? sorted[sorted.length - 1];
}

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  completed: "Completada",
};

// ── Estado constructivo de elementos 3D ─────────────────────────────────
export type ElementBuildStatus = "not_started" | "in_progress" | "built" | "unlinked";

export function elementBuildStatus(elementId: string, tasks: Task[]): ElementBuildStatus {
  const linked = tasks.filter((t) => t.elementIds.includes(elementId));
  if (!linked.length) return "unlinked";
  if (linked.every((t) => t.status === "done")) return "built";
  if (linked.some((t) => t.status !== "pending")) return "in_progress";
  return "not_started";
}

export const ELEMENT_STATUS_LABEL: Record<ElementBuildStatus, string> = {
  not_started: "No iniciado",
  in_progress: "En ejecución",
  built: "Ejecutado",
  unlinked: "Sin actividades vinculadas",
};

export function tasksForElement(el: ModelElement, tasks: Task[]) {
  return tasks.filter((t) => t.elementIds.includes(el.id));
}

// ── Cotizaciones ────────────────────────────────────────────────────────
export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  materials: "Materiales",
  labor: "Mano de obra",
  equipment: "Equipos",
  other: "Otros costos",
};

export const itemSubtotal = (i: QuoteItem) => Math.max(0, i.quantity) * Math.max(0, i.unitPrice);

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  base: number;
  admin: number;
  contingency: number;
  profit: number;
  vat: number;
  vatBaseLabel: string;
  total: number;
}

export function quoteTotals(items: QuoteItem[], adj: QuoteAdjustments): QuoteTotals {
  const subtotal = items.reduce((s, i) => s + itemSubtotal(i), 0);
  const discount = subtotal * (clampPct(adj.discountPct) / 100);
  const base = subtotal - discount;
  const admin = adj.aiu.enabled ? base * (clampPct(adj.aiu.adminPct) / 100) : 0;
  const contingency = adj.aiu.enabled ? base * (clampPct(adj.aiu.contingencyPct) / 100) : 0;
  const profit = adj.aiu.enabled ? base * (clampPct(adj.aiu.profitPct) / 100) : 0;
  // En contratos AIU el IVA se liquida sobre la utilidad; en los demás, sobre la base.
  const vatBase = adj.aiu.enabled ? profit : base;
  const vat = adj.vat.enabled ? vatBase * (clampPct(adj.vat.ratePct) / 100) : 0;
  return {
    subtotal,
    discount,
    base,
    admin,
    contingency,
    profit,
    vat,
    vatBaseLabel: adj.aiu.enabled ? "sobre la utilidad (AIU)" : "sobre la base",
    total: base + admin + contingency + profit + vat,
  };
}

const clampPct = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

export function quotesSummary(quotes: Quote[]) {
  const active = quotes.filter((q) => q.status !== "rejected");
  const byCategory: Record<CostCategory, number> = { materials: 0, labor: 0, equipment: 0, other: 0 };
  let total = 0;
  for (const q of active) {
    total += quoteTotals(q.items, q.adjustments).total;
    for (const it of q.items) byCategory[it.category] += itemSubtotal(it);
  }
  const directSum = Object.values(byCategory).reduce((a, b) => a + b, 0) || 1;
  const approvedValue = quotes.filter((q) => q.status === "approved").reduce((s, q) => s + quoteTotals(q.items, q.adjustments).total, 0);
  return {
    total,
    approvedValue,
    count: quotes.length,
    approved: quotes.filter((q) => q.status === "approved").length,
    pending: quotes.filter((q) => q.status === "pending").length,
    drafts: quotes.filter((q) => q.status === "draft").length,
    distribution: (Object.keys(byCategory) as CostCategory[]).map((k) => ({ key: k, label: COST_CATEGORY_LABEL[k], value: byCategory[k], share: byCategory[k] / directSum })),
    /** Fracción del valor cotizado que ya está aprobado */
    approvedShare: total ? approvedValue / total : 0,
  };
}

// ── Inventario ──────────────────────────────────────────────────────────
export function inventoryItems(materials: Material[]): InventoryItem[] {
  return materials.map((m) => {
    const stock = m.receivedQty - m.consumedQty;
    return { materialId: m.id, name: m.name, unit: m.unit, stock, minStock: m.minStock, low: m.minStock > 0 && stock < m.minStock };
  });
}

/** Número de movimientos (no cantidades: las unidades no son sumables) por semana. */
export function weeklyMovementCounts(movements: InventoryMovement[], endISO: string, weeks = 8) {
  const end = parseISODate(endISO).getTime();
  const buckets = Array.from({ length: weeks }, (_, i) => ({ week: i, label: `S${i + 1}`, in: 0, out: 0 }));
  for (const m of movements) {
    const diffWeeks = Math.floor((end - parseISODate(m.date).getTime()) / (7 * 86_400_000));
    const idx = weeks - 1 - diffWeeks;
    if (idx < 0 || idx >= weeks) continue;
    buckets[idx][m.type]++;
  }
  return buckets;
}

// ── Finanzas ────────────────────────────────────────────────────────────
export function plannedAt(curve: { date: string; amount: number }[], iso: string) {
  const t = parseISODate(iso).getTime();
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    const ta = parseISODate(a.date).getTime();
    const tb = parseISODate(b.date).getTime();
    if (t <= tb) {
      if (t <= ta) return a.amount;
      return a.amount + ((t - ta) / (tb - ta)) * (b.amount - a.amount);
    }
  }
  return curve[curve.length - 1]?.amount ?? 0;
}

export function financialSummary(approvedBudget: number, expenses: Expense[], plannedToDate: number): FinancialSummary {
  const executed = expenses.reduce((s, e) => s + (e.counts === false ? 0 : e.amount), 0);
  return {
    approvedBudget,
    executed,
    available: approvedBudget - executed,
    executionPct: approvedBudget ? executed / approvedBudget : 0,
    plannedToDate,
    deviationPct: plannedToDate ? (executed - plannedToDate) / plannedToDate : 0,
  };
}
