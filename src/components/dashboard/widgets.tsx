"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, Bar, BarChart, XAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CalendarDays, Check, Ellipsis, FileText, Info, Package, ChartColumn, Plus, TriangleAlert } from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useMemo, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useProjectStore } from "@/stores/projectStore";
import { useUI, type ModuleKey } from "@/stores/uiStore";
import { DEMO_BASE_DATE } from "@/data/demo";
import { useCatalog } from "@/hooks/useCatalog";
import { financialSummary, inventoryItems, plannedAt, quotesSummary, weeklyMovementCounts } from "@/lib/domain";
import { cn, formatCOP, formatCOPMillions, formatNumber, formatPct, relativeDue, todayISO } from "@/lib/format";
import { isRemote } from "@/lib/supabase";
import { CardHeader, GlassButton, GlassCard, ProgressBar } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";
import { PRIORITY_LABEL } from "./StageDetailDrawer";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { SetupEmpty } from "@/components/setup/SetupEmpty";

const int = (n: number) => String(Math.round(n));
const pctInt = (n: number) => `${Math.round(n)} %`;

/** Paleta categórica validada (CVD) para la distribución de costos. Orden fijo. */
export const COST_COLORS = { materials: "#0f6e45", labor: "#4cb886", equipment: "#3170b0", other: "#b07a3a" } as const;

function CardMenu({ items }: { items: { label: string; onSelect: () => void }[] }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="grid h-8 w-8 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label="Más acciones">
          <Ellipsis size={18} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className="anim-pop glass-float z-50 min-w-48 rounded-[16px] p-1.5">
          {items.map((i) => (
            <Dropdown.Item key={i.label} onSelect={i.onSelect} className="cursor-pointer rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-white/85">
              {i.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function Widget({ children, className, fill = true }: { children: ReactNode; className?: string; fill?: boolean }) {
  return <GlassCard className={cn("flex flex-col p-5", fill && "h-full", className)}>{children}</GlassCard>;
}

const open = (m: ModuleKey) => useUI.getState().openModule(m);

// ── A · Cotizaciones ────────────────────────────────────────────────────
export function QuoteSummary() {
  const quotes = useProjectStore((s) => s.quotes);
  const setQuick = useUI((s) => s.setQuickQuoteOpen);
  const sum = useMemo(() => quotesSummary(quotes), [quotes]);

  return (
    <Widget>
      <CardHeader
        icon={<FileText size={20} strokeWidth={1.7} />}
        title="Resumen de cotización"
        hint={
          <Tooltip content="Suma de cotizaciones no rechazadas del proyecto, incluyendo AIU e IVA cuando aplican. La distribución usa los costos directos.">
            <button className="text-ink-3 hover:text-ink-2" aria-label="Cómo se calcula">
              <Info size={15} />
            </button>
          </Tooltip>
        }
        action={<CardMenu items={[{ label: "Ver cotizaciones", onSelect: () => open("quotes") }, { label: "Crear cotización", onSelect: () => setQuick(true) }]} />}
      />
      <p className="tabular mt-3 text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink">
        <AnimatedNumber value={sum.total} format={formatCOP} /> <span className="text-[14px] font-medium text-ink-2">COP</span>
      </p>
      <p className="mt-1.5 text-[12px] text-ink-2">
        {sum.count} cotizaciones · <span className="text-[#13704a]">{sum.approved} aprobadas</span> · {sum.pending} {sum.pending === 1 ? "pendiente" : "pendientes"}{sum.drafts ? ` · ${sum.drafts} ${sum.drafts === 1 ? "borrador" : "borradores"}` : ""}
      </p>

      <div className="mt-3 mb-4 flex items-center gap-4">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sum.distribution} dataKey="value" nameKey="label" innerRadius={44} outerRadius={58} paddingAngle={2} stroke="#fff" strokeWidth={2} cornerRadius={4} startAngle={90} endAngle={-270} isAnimationActive>
                {sum.distribution.map((d) => (
                  <Cell key={d.key} fill={COST_COLORS[d.key]} />
                ))}
              </Pie>
              <RTooltip
                formatter={(v) => formatCOP(Number(v))}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-md)", fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="tabular text-[17px] leading-none font-semibold text-ink"><AnimatedNumber value={sum.approvedShare * 100} format={pctInt} /></p>
              <p className="mt-1 text-[11px] text-ink-2">aprobado</p>
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {sum.distribution.map((d) => (
            <li key={d.key} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COST_COLORS[d.key] }} aria-hidden />
              <span className="flex-1 truncate text-ink">{d.label}</span>
              <span className="tabular text-ink-2">{Math.round(d.share * 100)} %</span>
            </li>
          ))}
        </ul>
      </div>
      <button onClick={() => open("quotes")} className="glass mt-auto flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full text-[13px] font-medium text-ink transition hover:bg-white">
        Ver cotizaciones <ArrowRight size={15} />
      </button>
    </Widget>
  );
}

// ── B · Materiales ──────────────────────────────────────────────────────
export function MaterialsWidget() {
  const { materials } = useCatalog();
  const setMaterialDetailId = useUI((s) => s.setMaterialDetailId);
  // En la demo se omite la grava para mantener la tarjeta compacta
  const list = materials.filter((m) => m.id !== "mat-gra");
  return (
    <Widget>
      <CardHeader
        icon={<Boxes size={20} strokeWidth={1.7} />}
        title="Uso de materiales"
        action={<CardMenu items={[{ label: "Ver todos los materiales", onSelect: () => open("materials") }, { label: "Ver inventario", onSelect: () => open("inventory") }]} />}
      />
      <p className="mt-1 text-[12px] text-ink-2">Recibido en obra frente a la cantidad prevista</p>
      {list.length === 0 && <SetupEmpty text="Sin materiales registrados." step="inventory" action="Agregar materiales" />}
      <ul className="mt-3 space-y-1">
        {list.map((m) => {
          const share = m.plannedQty ? m.receivedQty / m.plannedQty : 0;
          return (
            <li key={m.id}>
              <button onClick={() => setMaterialDetailId(m.id)} className="w-full rounded-[12px] px-2 py-1.5 text-left transition hover:bg-surface-2/70" aria-label={`${m.name}: ${formatNumber(m.receivedQty)} de ${formatNumber(m.plannedQty)} ${m.unit}`}>
                <span className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="tabular text-ink-2">{Math.round(share * 100)} %</span>
                </span>
                <ProgressBar value={share} className="mt-1.5" height={6} />
                <span className="tabular mt-1 block text-[11px] text-ink-3">
                  {formatNumber(m.receivedQty)} / {formatNumber(m.plannedQty)} {m.unit}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}

// ── C · Inventario ──────────────────────────────────────────────────────
export function InventoryWidget() {
  const { materials, movements } = useCatalog();
  const items = useMemo(() => inventoryItems(materials), [materials]);
  const weeks = useMemo(() => weeklyMovementCounts(movements, DEMO_BASE_DATE), [movements]);
  const low = items.filter((i) => i.low);
  const refs = items.filter((i) => i.stock > 0).length;
  const ins = weeks.reduce((s, w) => s + w.in, 0);
  const outs = weeks.reduce((s, w) => s + w.out, 0);

  return (
    <Widget fill={false}>
      <CardHeader
        icon={<Package size={20} strokeWidth={1.7} />}
        title="Inventario"
        action={<CardMenu items={[{ label: "Ver inventario", onSelect: () => open("inventory") }]} />}
      />
      <div className="mt-2 flex items-end gap-4">
        <div>
          <p className="tabular text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink">
            <AnimatedNumber value={refs} format={int} /> <span className="text-[14px] font-medium text-ink-2">referencias</span>
          </p>
          <p className="mt-1.5 text-[12px] text-ink-2">
            {ins} entradas · {outs} salidas
          </p>
          <p className="text-[11px] text-ink-3">Movimientos últimas 8 semanas
          </p>
        </div>
        <div className="ml-auto h-[52px] w-[120px]" aria-label="Movimientos de entrada por semana" role="img">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} barCategoryGap={3}>
              <XAxis dataKey="label" hide />
              <RTooltip
                cursor={{ fill: "rgba(16,41,31,0.05)" }}
                formatter={(v, n) => [`${v} movimientos`, n === "in" ? "Entradas" : "Salidas"]}
                labelFormatter={(l) => `Semana ${String(l).slice(1)}`}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-md)", fontSize: 12 }}
              />
              <Bar dataKey="in" fill="#2f8f61" radius={[4, 4, 0, 0]} minPointSize={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-3">
        {low.length ? (
          <button onClick={() => open("inventory")} className="flex w-full items-center gap-2 rounded-[12px] bg-warning-soft px-3 py-2 text-left text-[12px] text-[#7c5314] transition hover:brightness-[0.98]">
            <TriangleAlert size={14} className="shrink-0" />
            <span className="truncate">
              Stock bajo: {low.map((l) => l.name).join(", ")}
            </span>
          </button>
        ) : (
          <p className="text-[12px] text-ink-2">Sin alertas de abastecimiento.</p>
        )}
      </div>
    </Widget>
  );
}

// ── D · Finanzas ────────────────────────────────────────────────────────
export function useFinance() {
  const { expenses, plannedCurve, approvedBudget } = useCatalog();
  // Con datos reales el corte es hoy; en la demostración, la fecha fija de los datos de ejemplo
  const cut = isRemote ? todayISO() : DEMO_BASE_DATE;
  return useMemo(() => financialSummary(approvedBudget, expenses, plannedAt(plannedCurve, cut)), [approvedBudget, expenses, plannedCurve, cut]);
}

export function FinanceOverview() {
  const f = useFinance();
  const r = 30;
  const c = 2 * Math.PI * r;
  const over = f.deviationPct > 0;
  if (!f.approvedBudget)
    return (
      <Widget fill={false} className="flex-1">
        <CardHeader icon={<ChartColumn size={20} strokeWidth={1.7} />} title="Panorama financiero" />
        <SetupEmpty text="Define el presupuesto aprobado para medir la ejecución financiera." step="budget" action="Definir presupuesto" />
      </Widget>
    );
  return (
    <Widget fill={false} className="flex-1">
      <CardHeader icon={<ChartColumn size={20} strokeWidth={1.7} />} title="Panorama financiero" action={<CardMenu items={[{ label: "Ver finanzas", onSelect: () => open("finance") }]} />} />
      <div className="mt-2 mb-3 flex items-center gap-4">
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2.5">
          <div>
            <dd className="tabular text-[16px] font-semibold whitespace-nowrap text-ink"><AnimatedNumber value={f.executed} format={formatCOPMillions} /></dd>
            <dt className="text-[12px] text-ink-2">Consumido</dt>
          </div>
          <div>
            <dd className="tabular text-[16px] font-semibold whitespace-nowrap text-ink"><AnimatedNumber value={f.approvedBudget} format={formatCOPMillions} /></dd>
            <dt className="text-[12px] text-ink-2">Presupuesto</dt>
          </div>
          <div>
            <dd className="tabular text-[14px] font-medium text-ink"><AnimatedNumber value={f.available} format={formatCOPMillions} /></dd>
            <dt className="text-[12px] text-ink-2">Disponible</dt>
          </div>
          <div>
            <dd className={cn("tabular inline-flex items-center gap-0.5 text-[14px] font-medium", over ? "text-[#94631a]" : "text-[#13704a]")}>
              {over ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {formatPct(Math.abs(f.deviationPct))}
            </dd>
            <dt className="text-[12px] text-ink-2">vs. plan a la fecha</dt>
          </div>
        </dl>
        <div className="relative h-[76px] w-[76px] shrink-0" role="img" aria-label={`Ejecución financiera ${formatPct(f.executionPct)}`}>
          <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
            <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
            <motion.circle
              cx="38"
              cy="38"
              r={r}
              fill="none"
              stroke="#1b7a50"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: c * (1 - f.executionPct) }}
              transition={{ duration: 1.4, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="tabular text-[14px] leading-none font-semibold text-ink"><AnimatedNumber value={f.executionPct * 100} format={pctInt} /></p>
              <p className="mt-0.5 text-[10px] text-ink-2">Consumido</p>
            </div>
          </div>
        </div>
      </div>
      <button onClick={() => open("finance")} className="mt-auto flex items-center justify-center gap-1.5 rounded-[12px] bg-surface-2/80 py-2 text-[13px] font-medium text-ink transition hover:bg-surface-2">
        <Plus size={15} /> Registrar gasto
      </button>
    </Widget>
  );
}

// ── E · Actividad pendiente ─────────────────────────────────────────────
export function ActivityTimeline() {
  const { members } = useCatalog();
  const tasks = useProjectStore((s) => s.tasks);
  const toggle = useProjectStore((s) => s.toggleTaskDone);
  const openStage = useUI((s) => s.openStage);
  const toast = useUI((s) => s.toast);

  // Próximas actividades abiertas + las completadas recientemente en esta sesión (para poder deshacer)
  const upcoming = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.status === "in_progress" ? -1 : 1))
        .slice(0, 5),
    [tasks],
  );

  return (
    <Widget>
      <CardHeader
        icon={<CalendarDays size={20} strokeWidth={1.7} />}
        title="Actividad pendiente"
        action={<CardMenu items={[{ label: "Ver actividades de la etapa actual", onSelect: () => upcoming[0] && openStage(upcoming[0].stageId) }]} />}
      />
      {upcoming.length === 0 && <SetupEmpty text="No hay actividades pendientes." step="tasks" action="Agregar actividades" />}
      <ol className={cn("relative mt-3 flex-1", upcoming.length === 0 && "hidden")}>
        <span className="absolute top-3 bottom-3 left-[11px] w-px bg-line" aria-hidden />
        <AnimatePresence initial={false}>
          {upcoming.map((t) => {
            const who = members.find((m) => m.id === t.assigneeId);
            return (
              <motion.li key={t.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} className="relative flex gap-3 py-2">
                <button
                  onClick={() => {
                    if (toggle(t.id))
                      toast({ title: "Actividad completada", description: `${t.title} · avance de etapa actualizado` });
                  }}
                  className={cn(
                    "relative z-10 mt-0.5 grid h-[23px] w-[23px] shrink-0 place-items-center rounded-full border bg-white transition hover:border-accent hover:bg-accent-soft",
                    t.status === "in_progress" ? "border-accent" : "border-line-strong",
                  )}
                  aria-label={`Marcar como completada: ${t.title}`}
                >
                  <Check size={12} strokeWidth={3} className="text-accent opacity-0 transition group-hover:opacity-100" />
                  {t.status === "in_progress" && <span className="absolute h-2 w-2 rounded-full bg-accent" />}
                </button>
                <button onClick={() => openStage(t.stageId, t.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13px] font-medium text-ink hover:text-brand">{t.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-2">
                    {relativeDue(t.dueDate)} · {who?.name.split(" ").slice(0, 2).join(" ")} · {PRIORITY_LABEL[t.priority]}
                  </p>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      <GlassButton variant="ghost" size="sm" className="mt-2 self-start" onClick={() => upcoming[0] && openStage(upcoming[0].stageId)} trailing={<ArrowRight size={14} />}>
        Ver todas
      </GlassButton>
    </Widget>
  );
}
