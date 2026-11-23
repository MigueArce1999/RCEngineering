"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, HardHat, Lock, Package, Pencil, Plus, Receipt, Search, TrendingDown, Truck, Wallet, X } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CostCategory, Expense } from "@/types";
import { useUI } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useCan } from "@/stores/authStore";
import { useFinance } from "@/components/dashboard/widgets";
import { COST_CATEGORY_LABEL } from "@/lib/domain";
import { cn, formatCOP, formatCOPMillions, formatDate, formatPct, formatShortDate, parseISODate, todayISO } from "@/lib/format";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Deferred } from "@/components/ui/overlays";
import { GlassButton } from "@/components/ui/primitives";
import { ConfirmDelete, inputCls } from "@/components/docs/shared";

const EXPO = [0.16, 1, 0.3, 1] as const;
const CATS: CostCategory[] = ["materials", "labor", "equipment", "other"];
/** Paleta categórica validada (orden fijo; el color sigue a la categoría, nunca al rango) */
const CAT_COLOR: Record<CostCategory, string> = { materials: "#1b7a50", labor: "#3b6fd4", equipment: "#d18a1f", other: "#9a5fc9" };
const CAT_ICON: Record<CostCategory, ReactNode> = { materials: <Package size={15} />, labor: <HardHat size={15} />, equipment: <Truck size={15} />, other: <Receipt size={15} /> };
const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const digits = (v: string) => Number(v.replace(/\D/g, "").slice(0, 14)) || 0;
const money = (n: number) => (n ? new Intl.NumberFormat("es-CO").format(n) : "");
/** Consumo acumulado antes de empezar a registrar en la app (proyectos que ya venían en marcha) */
const OPENING = "Consumo previo (antes de usar la app)";
const isOpening = (e: Expense) => e.concept === OPENING;
/** Los gastos de nómina se crean y anulan desde el módulo de Nómina */
const isPayroll = (e: Expense) => e.category === "labor" && e.concept.startsWith("Nómina ·");

/** Módulo de finanzas: presupuesto, consumo, saldo disponible y registro de gastos. */
export function FinanceWorkspace() {
  const open = useUI((s) => s.module === "finance");
  const openModule = useUI((s) => s.openModule);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === s.projectId));

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && openModule("home")}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-[#0b1f17]/40" />
        <Dialog.Content onOpenAutoFocus={(e) => e.preventDefault()} className="anim-modal fixed top-1/2 left-1/2 z-50 flex h-[min(94dvh,960px)] w-[calc(100vw-16px)] max-w-[1360px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-[#f6f8f7] shadow-[var(--shadow-lg)] outline-none">
          <header className="flex items-center gap-4 border-b border-line/70 bg-white px-5 py-3.5 sm:px-7">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-accent-soft text-brand">
              <Wallet size={21} strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Finanzas</Dialog.Title>
              <Dialog.Description className="truncate text-[13px] text-ink-2">
                {project?.name ?? "Proyecto"} · corte al {formatDate(todayISO())} · COP
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label="Cerrar finanzas">
              <X size={18} />
            </Dialog.Close>
          </header>
          {open && (
            <Deferred>
              <Body />
            </Deferred>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body() {
  const expenses = useProjectStore((s) => s.expenses);
  const budget = useProjectStore((s) => s.approvedBudget);
  const canEdit = useCan("finance.manage");
  const f = useFinance();
  const [fresh, setFresh] = useState<string | null>(null);

  if (!budget) return <BudgetSetup canEdit={canEdit} />;

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="anim-stagger mx-auto grid max-w-[1320px] items-start gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <BudgetHero budget={budget} spent={f.executed} available={f.available} expenses={expenses} canEdit={canEdit} />
        </div>
        {canEdit && (
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <AddExpense onAdded={setFresh} available={f.available} />
          </div>
        )}
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <BalanceChart budget={budget} expenses={expenses} />
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-3">
          <Movements expenses={expenses} budget={budget} canEdit={canEdit} fresh={fresh} />
        </div>
        <div className={cn("lg:col-start-2", canEdit ? "lg:row-start-3" : "lg:row-start-1")}>
          <ByCategory expenses={expenses} spent={f.executed} />
        </div>
      </div>
    </div>
  );
}

// ── Sin presupuesto ─────────────────────────────────────────────────────
function BudgetSetup({ canEdit }: { canEdit: boolean }) {
  const setBudget = useProjectStore((s) => s.setBudget);
  const [v, setV] = useState(0);
  return (
    <div className="anim-content grid flex-1 place-items-center p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-accent-soft text-brand">
          <Wallet size={34} strokeWidth={1.5} />
        </span>
        <h3 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">¿Cuál es el presupuesto del proyecto?</h3>
        <p className="mt-2 text-[14px] text-ink-2">Con el presupuesto aprobado verás cuánto se ha consumido y cuánto queda disponible a medida que registras gastos.</p>
        {canEdit ? (
          <form
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (v > 0) void setBudget(v);
            }}
          >
            <MoneyInput value={v} onChange={setV} placeholder="Ej. 180.000.000" className="h-12 text-[16px]" autoFocus />
            <GlassButton type="submit" variant="primary" size="lg" disabled={!v}>
              Guardar
            </GlassButton>
          </form>
        ) : (
          <p className="mt-4 text-[13px] text-ink-3">Pide a un administrador que defina el presupuesto.</p>
        )}
      </div>
    </div>
  );
}

function MoneyInput({ value, onChange, className, ...rest }: { value: number; onChange: (n: number) => void; className?: string; placeholder?: string; autoFocus?: boolean; "aria-label"?: string }) {
  return (
    <label className="relative block flex-1">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[14px] text-ink-3">$</span>
      <input {...rest} inputMode="numeric" value={money(value)} onChange={(e) => onChange(digits(e.target.value))} className={cn(inputCls, "tabular pl-7", className)} />
    </label>
  );
}

// ── Presupuesto · consumido · disponible ────────────────────────────────
function BudgetHero({ budget, spent, available, expenses, canEdit }: { budget: number; spent: number; available: number; expenses: Expense[]; canEdit: boolean }) {
  const setBudget = useProjectStore((s) => s.setBudget);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(budget);
  const used = budget ? spent / budget : 0;
  const over = available < 0;
  const tone = over ? "critical" : used >= 0.85 ? "warning" : "good";
  const byCat = CATS.map((c) => ({ c, v: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.v > 0);
  const scale = Math.max(budget, spent);

  return (
    <section className="overflow-hidden rounded-[24px] bg-[#0f2a20] p-5 text-white shadow-[var(--shadow-md)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-white/65">{over ? "Presupuesto excedido por" : "Disponible"}</p>
          <p className={cn("tabular mt-1 text-[40px] leading-none font-semibold tracking-[-0.035em] sm:text-[56px]", over && "text-[#ff9c8f]")}>
            <AnimatedNumber value={Math.abs(available)} format={formatCOP} duration={1.4} />
          </p>
          <p className="mt-2 text-[14px] text-white/65">
            de <span className="tabular font-medium text-white">{formatCOP(budget)}</span> presupuestados
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold", tone === "good" ? "bg-[#2ea06e]/20 text-[#8fe0b5]" : tone === "warning" ? "bg-[#d18a1f]/25 text-[#ffd08a]" : "bg-[#e5484d]/25 text-[#ffb0a8]")}>
          {tone === "good" ? <Check size={13} /> : <TrendingDown size={13} />}
          {tone === "good" ? "Dentro del presupuesto" : tone === "warning" ? "Queda menos del 15 %" : "Sobrecosto"}
        </span>
      </div>

      {/* Barra de consumo: cada categoría ocupa su parte; lo que queda es el disponible */}
      <div className="mt-7">
        <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-white/10" role="img" aria-label={`Consumido ${formatPct(used)} del presupuesto`}>
          {byCat.map(({ c, v }, i) => (
            <motion.span key={c} className="h-full first:rounded-l-full" style={{ backgroundColor: CAT_COLOR[c] }} initial={{ width: 0 }} animate={{ width: `${(v / scale) * 100}%` }} transition={{ duration: 1.1, delay: 0.15 + i * 0.08, ease: EXPO }} title={`${COST_CATEGORY_LABEL[c]}: ${formatCOP(v)}`} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[12px] text-white/55">
          <span>
            Consumido <span className="tabular font-semibold text-white">{formatPct(used)}</span>
          </span>
          <span>Disponible {formatPct(Math.max(0, 1 - used))}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[16px] bg-white/10">
        <Stat label="Presupuesto">
          {editing ? (
            <form
              className="flex items-center gap-1.5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (draft > 0 && (await setBudget(draft))) setEditing(false);
              }}
            >
              <input autoFocus inputMode="numeric" value={money(draft)} onChange={(e) => setDraft(digits(e.target.value))} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} className="tabular h-8 w-full min-w-0 rounded-[8px] bg-white px-2 text-[14px] text-ink outline-none" aria-label="Nuevo presupuesto" />
              <button type="submit" className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#2ea06e]" aria-label="Guardar presupuesto">
                <Check size={15} />
              </button>
            </form>
          ) : (
            <span className="flex items-center gap-2">
              <AnimatedNumber value={budget} format={formatCOPMillions} />
              {canEdit && (
                <button onClick={() => (setDraft(budget), setEditing(true))} className="grid h-6 w-6 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white" aria-label="Editar presupuesto">
                  <Pencil size={12} />
                </button>
              )}
            </span>
          )}
        </Stat>
        <Stat label="Consumido">
          <OpeningEditor spent={spent} expenses={expenses} canEdit={canEdit} />
        </Stat>
        <Stat label="Disponible">
          <AnimatedNumber value={available} format={formatCOPMillions} />
        </Stat>
      </div>
    </section>
  );
}

/** Lápiz de "Consumido": fija el consumo acumulado previo (lo gastado antes de usar la app). */
function OpeningEditor({ spent, expenses, canEdit }: { spent: number; expenses: Expense[]; canEdit: boolean }) {
  const add = useProjectStore((s) => s.addExpense);
  const update = useProjectStore((s) => s.updateExpense);
  const remove = useProjectStore((s) => s.removeExpense);
  const startDate = useProjectStore((s) => s.projects.find((p) => p.id === s.projectId)?.startDate);
  const existing = expenses.find(isOpening);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(existing?.amount ?? 0);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    let ok = true;
    if (draft > 0 && existing) ok = await update({ ...existing, amount: draft });
    else if (draft > 0) ok = await add({ date: startDate && startDate <= todayISO() ? startDate : todayISO(), concept: OPENING, category: "other", amount: draft });
    else if (existing) ok = await remove(existing.id);
    setBusy(false);
    if (ok) setEditing(false);
  };

  if (editing)
    return (
      <div className="space-y-2">
        <p className="text-[11px] leading-snug font-normal whitespace-normal text-white/70">Lo gastado antes de registrar aquí</p>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input autoFocus inputMode="numeric" value={money(draft)} onChange={(e) => setDraft(digits(e.target.value))} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} placeholder="0" className="tabular h-8 w-full min-w-0 rounded-[8px] bg-white px-2 text-[14px] text-ink outline-none" aria-label="Consumo previo acumulado" />
          <button type="submit" disabled={busy} className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#2ea06e] disabled:opacity-60" aria-label="Guardar consumo previo">
            <Check size={15} />
          </button>
        </form>
      </div>
    );

  return (
    <span className="flex items-center gap-2">
      <AnimatedNumber value={spent} format={formatCOPMillions} />
      {canEdit && (
        <button onClick={() => (setDraft(existing?.amount ?? 0), setEditing(true))} className="grid h-6 w-6 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white" aria-label="Editar consumo previo acumulado" title="Ingresar lo ya consumido antes de usar la app">
          <Pencil size={12} />
        </button>
      )}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-[#0f2a20] px-2.5 py-3 sm:px-4">
      <p className="truncate text-[10px] font-medium tracking-wide text-white/55 uppercase sm:text-[11px]">{label}</p>
      <div className="tabular mt-1 text-[14px] font-semibold whitespace-nowrap sm:text-[18px]">{children}</div>
    </div>
  );
}

// ── Saldo en el tiempo ──────────────────────────────────────────────────
function BalanceChart({ budget, expenses }: { budget: number; expenses: Expense[] }) {
  const startDate = useProjectStore((s) => s.projects.find((p) => p.id === s.projectId)?.startDate);
  const data = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of expenses) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amount);
    const days = [...byDay.keys()].sort();
    const start = startDate && (!days[0] || startDate < days[0]) ? startDate : (days[0] ?? todayISO());
    let bal = budget;
    const pts = [{ date: start, saldo: budget, gasto: 0 }];
    for (const d of days) {
      bal -= byDay.get(d)!;
      pts.push({ date: d, saldo: bal, gasto: byDay.get(d)! });
    }
    const today = todayISO();
    if (pts[pts.length - 1].date < today) pts.push({ date: today, saldo: bal, gasto: 0 });
    return pts.map((p) => ({ ...p, t: parseISODate(p.date).getTime() }));
  }, [budget, expenses, startDate]);
  // Escala acercada al rango del saldo para que cada gasto se note (el eje lo indica)
  const minBal = Math.min(...data.map((d) => d.saldo));
  const span = Math.max(budget - minBal, budget * 0.05);
  const domain: [number, number] = [minBal < 0 ? minBal - span * 0.1 : Math.max(0, minBal - span * 0.25), budget + span * 0.05];

  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-line/70 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">Saldo disponible en el tiempo</h3>
        <span className="text-[12px] text-ink-3">Baja con cada gasto registrado</span>
      </div>
      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t: number) => formatShortDate(new Date(t).toISOString().slice(0, 10))} tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tickFormatter={(v: number) => formatCOPMillions(v)} tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} width={72} domain={domain} allowDataOverflow />
            {domain[0] <= 0 && <ReferenceLine y={0} stroke="var(--ink-3)" strokeOpacity={0.5} />}
            <Tooltip
              cursor={{ stroke: "var(--ink-3)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload;
                if (!p) return null;
                return (
                  <div className="rounded-[12px] bg-white px-3 py-2 text-[12px] shadow-[var(--shadow-md)] ring-1 ring-line">
                    <p className="text-ink-2">{formatDate(p.date)}</p>
                    <p className="tabular mt-0.5 text-[14px] font-semibold text-ink">{formatCOP(p.saldo)}</p>
                    {p.gasto > 0 && <p className="tabular text-ink-2">Gastos del día: −{formatCOP(p.gasto)}</p>}
                  </div>
                );
              }}
            />
            <Line type="stepAfter" dataKey="saldo" stroke="#1b7a50" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff", fill: "#1b7a50" }} isAnimationActive animationDuration={900} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ── Registrar gasto ─────────────────────────────────────────────────────
function AddExpense({ onAdded, available }: { onAdded: (id: string) => void; available: number }) {
  const add = useProjectStore((s) => s.addExpense);
  const [f, setF] = useState({ concept: "", amount: 0, category: "materials" as CostCategory, date: todayISO() });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.concept.trim() || !f.amount) return;
    setBusy(true);
    const before = new Set(useProjectStore.getState().expenses.map((x) => x.id));
    const ok = await add({ ...f, concept: f.concept.trim() });
    setBusy(false);
    if (ok) {
      const added = useProjectStore.getState().expenses.find((x) => !before.has(x.id));
      if (added) onAdded(added.id);
      setF((x) => ({ ...x, concept: "", amount: 0 }));
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-[24px] bg-white p-5 ring-1 ring-line/70 sm:p-6">
      <h3 className="text-[15px] font-semibold text-ink">Registrar gasto</h3>
      <p className="mt-0.5 text-[12px] text-ink-2">Se descuenta del disponible al instante. Si el proyecto ya venía en marcha, registra los gastos importantes con su fecha real, o ingresa el total ya consumido con el lápiz ✏️ de <strong className="font-semibold text-ink">Consumido</strong>.</p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Concepto</span>
        <input value={f.concept} onChange={(e) => setF((x) => ({ ...x, concept: e.target.value }))} maxLength={160} placeholder="Ej. Cemento gris · 120 bultos" className={inputCls} />
      </label>
      <div className="mt-3 grid grid-cols-[1fr_150px] gap-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Valor</span>
          <MoneyInput value={f.amount} onChange={(amount) => setF((x) => ({ ...x, amount }))} placeholder="0" aria-label="Valor del gasto" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Fecha</span>
          <input type="date" value={f.date} max={todayISO()} onChange={(e) => e.target.value && setF((x) => ({ ...x, date: e.target.value }))} className={cn(inputCls, "px-2.5")} />
        </label>
      </div>
      <p className="mt-3 mb-1.5 text-[12px] font-medium text-ink-2">Categoría</p>
      <div className="grid grid-cols-2 gap-1.5">
        {CATS.map((c) => (
          <button type="button" key={c} onClick={() => setF((x) => ({ ...x, category: c }))} aria-pressed={f.category === c} className={cn("flex h-10 items-center gap-2 rounded-[12px] px-3 text-[13px] font-medium transition", f.category === c ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:text-ink")}>
            <span style={{ color: f.category === c ? "#fff" : CAT_COLOR[c] }}>{CAT_ICON[c]}</span>
            {COST_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {f.amount > 0 && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="tabular overflow-hidden pt-3 text-[12px] text-ink-2">
            Disponible después: <span className={cn("font-semibold", available - f.amount < 0 ? "text-danger" : "text-ink")}>{formatCOP(available - f.amount)}</span>
          </motion.p>
        )}
      </AnimatePresence>
      <button type="submit" disabled={busy || !f.concept.trim() || !f.amount} className={cn("mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold text-white transition disabled:opacity-45", done ? "bg-[#2ea06e]" : "bg-brand hover:brightness-110")}>
        {done ? <Check size={18} /> : <Plus size={18} />} {busy ? "Registrando…" : done ? "Gasto registrado" : "Registrar gasto"}
      </button>
    </form>
  );
}

// ── Por categoría ───────────────────────────────────────────────────────
function ByCategory({ expenses, spent }: { expenses: Expense[]; spent: number }) {
  const rows = CATS.map((c) => {
    const list = expenses.filter((e) => e.category === c);
    return { c, v: list.reduce((s, e) => s + e.amount, 0), n: list.length };
  });
  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-line/70 sm:p-6">
      <h3 className="text-[15px] font-semibold text-ink">Consumo por categoría</h3>
      <ul className="mt-4 space-y-3.5">
        {rows.map(({ c, v, n }, i) => (
          <li key={c}>
            <div className="flex items-center gap-2.5 text-[13px]">
              <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-surface-2" style={{ color: CAT_COLOR[c] }}>
                {CAT_ICON[c]}
              </span>
              <span className="flex-1 text-ink">
                {COST_CATEGORY_LABEL[c]} <span className="text-ink-3">· {n}</span>
              </span>
              <span className="tabular font-semibold text-ink">{formatCOP(v)}</span>
            </div>
            <div className="mt-1.5 ml-[38px] flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <motion.div className="h-full rounded-full" style={{ backgroundColor: CAT_COLOR[c] }} initial={{ width: 0 }} animate={{ width: `${spent ? (v / spent) * 100 : 0}%` }} transition={{ duration: 1, delay: 0.1 + i * 0.06, ease: EXPO }} />
              </div>
              <span className="tabular w-10 text-right text-[11px] text-ink-3">{spent ? formatPct(v / spent) : "0 %"}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Movimientos ─────────────────────────────────────────────────────────
function Movements({ expenses, budget, canEdit, fresh }: { expenses: Expense[]; budget: number; canEdit: boolean; fresh: string | null }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CostCategory | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);

  // Saldo después de cada gasto (orden cronológico) y lista de la más reciente a la más antigua
  const rows = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const out: { e: Expense; after: number }[] = [];
    sorted.reduce((bal, e) => {
      out.push({ e, after: bal - e.amount });
      return bal - e.amount;
    }, budget);
    return out.reverse();
  }, [expenses, budget]);
  const term = q.trim().toLowerCase();
  const visible = rows.filter(({ e }) => (cat === "all" || e.category === cat) && (!term || e.concept.toLowerCase().includes(term)));
  const groups = useMemo(() => {
    const g: { key: string; items: typeof visible }[] = [];
    for (const r of visible) {
      const key = r.e.date.slice(0, 7);
      let grp = g.find((x) => x.key === key);
      if (!grp) g.push((grp = { key, items: [] }));
      grp.items.push(r);
    }
    return g;
  }, [visible]);

  const exportCSV = () => {
    const lines = [["Fecha", "Concepto", "Categoría", "Valor", "Saldo después"], ...rows.map(({ e, after }) => [e.date, e.concept, COST_CATEGORY_LABEL[e.category], String(e.amount), String(after)])];
    const csv = "﻿" + lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `gastos-${todayISO()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };

  return (
    <section className="rounded-[24px] bg-white ring-1 ring-line/70">
      <div className="space-y-3 border-b border-line/70 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <h3 className="mr-auto text-[15px] font-semibold text-ink">
            Gastos <span className="font-normal text-ink-3">· {expenses.length}</span>
          </h3>
          <GlassButton variant="outline" size="sm" icon={<Download size={14} />} onClick={exportCSV} disabled={!expenses.length}>
            Excel
          </GlassButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[140px] flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar gasto" className={cn(inputCls, "h-9 pl-8 text-[13px]")} />
        </label>
        <div className="scroll-thin flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
          {(["all", ...CATS] as const).map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn("h-7 shrink-0 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap transition", cat === c ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}>
              {c === "all" ? "Todos" : COST_CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        </div>
      </div>

      {!expenses.length ? (
        <p className="px-6 py-12 text-center text-[13px] text-ink-3">Aún no hay gastos. Regístralos con el formulario y verás cómo baja el disponible.</p>
      ) : !visible.length ? (
        <p className="px-6 py-12 text-center text-[13px] text-ink-3">Ningún gasto coincide con el filtro.</p>
      ) : (
        <div className="px-2 pb-2 sm:px-3">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="px-3 pt-4 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase first-letter:uppercase">{monthFmt.format(parseISODate(`${g.key}-01`))}</p>
              <ul>
                <AnimatePresence initial={false}>
                  {g.items.map(({ e, after }) => (
                    <motion.li key={e.id} layout initial={{ opacity: 0, y: -8, backgroundColor: "rgba(46,160,110,0.14)" }} animate={{ opacity: 1, y: 0, backgroundColor: e.id === fresh ? ["rgba(46,160,110,0.14)", "rgba(46,160,110,0)"] : "rgba(46,160,110,0)" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 1.2, ease: EXPO }} className="rounded-[14px]">
                      {editing === e.id ? <EditRow e={e} onDone={() => setEditing(null)} /> : <Row e={e} after={after} canEdit={canEdit} onEdit={() => setEditing(e.id)} />}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ e, after, canEdit, onEdit }: { e: Expense; after: number; canEdit: boolean; onEdit: () => void }) {
  const remove = useProjectStore((s) => s.removeExpense);
  const payroll = isPayroll(e);
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-surface-2" style={{ color: CAT_COLOR[e.category] }}>
        {CAT_ICON[e.category]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{e.concept}</p>
        <p className="text-[12px] text-ink-2">
          {formatDate(e.date)} · {COST_CATEGORY_LABEL[e.category]}
          {payroll && <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-brand">Nómina</span>}
          {isOpening(e) && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-semibold text-ink-2">Saldo inicial</span>}
        </p>
      </div>
      <div className="text-right">
        <p className="tabular text-[14px] font-semibold text-ink">−{formatCOP(e.amount)}</p>
        <p className={cn("tabular text-[11px]", after < 0 ? "text-danger" : "text-ink-3")}>Saldo {formatCOP(after)}</p>
      </div>
      {canEdit && (
        <div className="flex w-[76px] shrink-0 justify-end gap-0.5 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {payroll ? (
            <span className="grid h-8 w-8 place-items-center text-ink-3" title="Se gestiona desde Nómina (reabre la liquidación para anularlo)">
              <Lock size={14} />
            </span>
          ) : (
            <>
              <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label={`Editar ${e.concept}`}>
                <Pencil size={14} />
              </button>
              <ConfirmDelete size="sm" label="" className="min-w-8 px-2" onConfirm={() => void remove(e.id)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EditRow({ e, onDone }: { e: Expense; onDone: () => void }) {
  const update = useProjectStore((s) => s.updateExpense);
  const [f, setF] = useState(e);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-2 p-2.5 sm:grid-cols-[1fr_150px_140px_150px_auto] sm:items-center"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (!f.concept.trim() || !f.amount) return;
        setBusy(true);
        if (await update({ ...f, concept: f.concept.trim() })) onDone();
        setBusy(false);
      }}
      onKeyDown={(ev) => ev.key === "Escape" && onDone()}
    >
      <input autoFocus value={f.concept} onChange={(ev) => setF((x) => ({ ...x, concept: ev.target.value }))} maxLength={160} className={cn(inputCls, "h-9 text-[13px]")} aria-label="Concepto" />
      <MoneyInput value={f.amount} onChange={(amount) => setF((x) => ({ ...x, amount }))} className="h-9 text-[13px]" aria-label="Valor" />
      <select value={f.category} onChange={(ev) => setF((x) => ({ ...x, category: ev.target.value as CostCategory }))} className={cn(inputCls, "h-9 px-2 text-[13px]")} aria-label="Categoría">
        {CATS.map((c) => (
          <option key={c} value={c}>
            {COST_CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      <input type="date" value={f.date} max={todayISO()} onChange={(ev) => ev.target.value && setF((x) => ({ ...x, date: ev.target.value }))} className={cn(inputCls, "h-9 px-2 text-[13px]")} aria-label="Fecha" />
      <div className="flex gap-1">
        <GlassButton type="submit" variant="primary" size="sm" disabled={busy}>
          Guardar
        </GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </GlassButton>
      </div>
    </form>
  );
}
