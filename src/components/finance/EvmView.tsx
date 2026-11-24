"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, CircleHelp, Plus, Table2, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useProjectStore } from "@/stores/projectStore";
import { useProgress } from "@/stores/progressStore";
import { useCan } from "@/stores/authStore";
import { useProjectData } from "@/hooks/useProjectData";
import { axisDate, axisM, computeEvm, indexTone, type EvmMetrics, type EvmTone } from "@/lib/evm";
import { cn, formatCOP, formatCOPMillions, formatDate, formatPct, todayISO } from "@/lib/format";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Skeleton } from "@/components/ui/primitives";
import { inputCls } from "@/components/docs/shared";
import { isOpening } from "@/lib/financeUi";

const EXPO = [0.16, 1, 0.3, 1] as const;
/** Series: valor planeado (neutro, discontinuo), valor ganado (verde) y costo real (azul). Validados para daltonismo. */
const C = { pv: "#6e7f77", ev: "#1b7a50", ac: "#3b6fd4" };
const TONE: Record<EvmTone, { fg: string; bg: string; label: string }> = {
  good: { fg: "#13704a", bg: "#dff3e9", label: "En línea" },
  watch: { fg: "#7c5314", bg: "#fbefd5", label: "Vigilar" },
  bad: { fg: "#b3352b", bg: "#fbe3e0", label: "Alerta" },
  none: { fg: "#5b6b64", bg: "#eef2f0", label: "Sin datos" },
};
const ARC: Record<EvmTone, string> = { good: "#1b7a50", watch: "#d18a1f", bad: "#d4483b", none: "#9aa8a1" };
const pesos = (n: number) => `$${n.toFixed(2).replace(".", ",")}`;
const digitsPct = (v: string) => Math.min(100, Math.max(0, Number(v.replace(/[^\d.,]/g, "").replace(",", ".")) || 0));

/** Valor ganado: ¿lo que se ha gastado corresponde con lo que realmente se ha construido? */
export function EvmView() {
  const project = useProjectStore((s) => s.projects.find((p) => p.id === s.projectId));
  const budget = useProjectStore((s) => s.approvedBudget);
  const curve = useProjectStore((s) => s.plannedCurve);
  const expenses = useProjectStore((s) => s.expenses);
  const { overall } = useProjectData();
  const entries = useProgress((s) => s.entries);
  const state = useProgress((s) => s.state);
  const load = useProgress((s) => s.load);
  const canEdit = useCan("finance.manage");

  useEffect(() => {
    void load();
  }, [load]);

  const bac = project?.quotedValue || budget;
  const hasEntries = entries.length > 0;
  const { series, metrics } = useMemo(
    () => computeEvm({ bac, start: project?.startDate ?? todayISO(), end: project?.plannedEndDate ?? todayISO(), curve, expenses, progress: entries.map((e) => ({ date: e.date, pct: e.pct })) }),
    [bac, project?.startDate, project?.plannedEndDate, curve, expenses, entries],
  );

  if (!bac) return <Empty title="Primero define el valor del proyecto" text="El valor ganado se mide contra la cotización o el presupuesto. Defínelo en la pestaña Resumen." />;
  if (state === "loading" || state === "idle")
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 rounded-[24px]" />
        <Skeleton className="h-72 rounded-[24px]" />
      </div>
    );

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="anim-stagger mx-auto grid max-w-[1320px] items-start gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {metrics ? <Verdict m={metrics} /> : <FirstRecord autoPct={overall} canEdit={canEdit} />}
          {metrics && <EvmChart series={series} m={metrics} />}
          {metrics && <Indicators m={metrics} />}
          {metrics && <Figures m={metrics} />}
        </div>
        <aside className="space-y-5 lg:sticky lg:top-0">
          <ProgressLog canEdit={canEdit} autoPct={overall} hasEntries={hasEntries} />
          <HowToRead />
        </aside>
      </div>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="anim-content grid flex-1 place-items-center p-8 text-center">
      <div className="max-w-md">
        <TrendingUp className="mx-auto text-ink-3" size={30} />
        <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
        <p className="mt-2 text-[14px] text-ink-2">{text}</p>
      </div>
    </div>
  );
}

// ── Veredicto en lenguaje llano ─────────────────────────────────────────
function Verdict({ m }: { m: EvmMetrics }) {
  const cost = indexTone(m.cpi);
  const time = indexTone(m.spi);
  const worst: EvmTone = cost === "bad" || time === "bad" ? "bad" : cost === "watch" || time === "watch" ? "watch" : cost === "none" ? "none" : "good";
  const t = TONE[worst];
  const costText =
    m.cpi === null ? "Aún no hay gasto registrado para comparar." : m.cpi >= 0.97 ? "El costo va en línea con lo construido." : m.cpi >= 0.85 ? "Hay un sobrecosto leve: conviene revisar los gastos recientes." : "Se está gastando bastante más de lo que vale lo construido.";
  const timeText = m.spi === null ? "" : m.spi >= 1.03 ? "Vas adelantado respecto al plan." : m.spi >= 0.97 ? "Vas al ritmo del plan." : m.spi >= 0.85 ? "Hay un atraso leve frente al plan." : "Hay un atraso importante frente al plan.";

  return (
    <section className="overflow-hidden rounded-[24px] bg-white p-5 ring-1 ring-line/70 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-2">Rendimiento del proyecto al {formatDate(todayISO())}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ color: t.fg, backgroundColor: t.bg }}>
          {worst === "good" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {t.label}
        </span>
      </div>
      {m.cpi !== null ? (
        <p className="mt-2 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink sm:text-[40px]">
          Por cada <span className="tabular">$1</span> gastado se han construido <span className="tabular" style={{ color: t.fg }}>{pesos(m.cpi)}</span>
        </p>
      ) : (
        <p className="mt-2 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink sm:text-[36px]">Avance real del {formatPct(m.pct)}</p>
      )}
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-2">
        {costText} {timeText}
        {m.eac !== null && (
          <>
            {" "}
            Si el rendimiento actual continúa, la obra terminaría costando <strong className="tabular text-ink">{formatCOPMillions(m.eac)}</strong>
            {m.vac !== null && Math.abs(m.vac) > m.bac * 0.005 && (
              <>
                , es decir <strong className={cn("tabular", m.vac < 0 ? "text-danger" : "text-[#13704a]")}>{formatCOPMillions(Math.abs(m.vac))}</strong> {m.vac < 0 ? "por encima" : "por debajo"} del valor base
              </>
            )}
            .
          </>
        )}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[16px] bg-line/70">
        <Bar label="Avance real" value={m.pct} color={C.ev} sub={formatCOPMillions(m.ev)} />
        <Bar label="Avance planeado" value={m.bac ? m.pv / m.bac : 0} color={C.pv} sub={formatCOPMillions(m.pv)} />
        <Bar label="Gastado" value={m.bac ? m.ac / m.bac : 0} color={C.ac} sub={formatCOPMillions(m.ac)} />
      </div>
    </section>
  );
}

function Bar({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div className="bg-white px-3 py-3 sm:px-4">
      <p className="truncate text-[11px] font-medium tracking-wide text-ink-3 uppercase">{label}</p>
      <p className="tabular mt-1 text-[20px] font-semibold text-ink sm:text-[24px]">
        <AnimatedNumber value={value * 100} format={(n) => `${n.toFixed(n < 10 ? 1 : 0).replace(".", ",")} %`} />
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, value * 100)}%` }} transition={{ duration: 1.2, delay: 0.2, ease: EXPO }} />
      </div>
      <p className="tabular mt-1.5 text-[11px] text-ink-3">{sub}</p>
    </div>
  );
}

// ── Gráfica de las tres curvas ──────────────────────────────────────────
function EvmChart({ series, m }: { series: ReturnType<typeof computeEvm>["series"]; m: EvmMetrics }) {
  const hasOpening = useProjectStore((s) => s.expenses.some(isOpening));
  const [table, setTable] = useState(false);
  const today = todayISO();
  const top = Math.max(m.bac, ...series.map((p) => Math.max(p.pv, p.ac ?? 0, p.forecast ?? 0)));
  const tableRows = useMemo(() => {
    const seen = new Set<string>();
    return series.filter((p) => {
      const k = p.date === today ? "hoy" : p.date.slice(0, 7);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [series, today]);
  const last = [...series].reverse().find((p) => p.date <= today && p.ev !== null);

  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-line/70 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h3 className="mr-auto text-[15px] font-semibold text-ink">Las tres curvas en el tiempo</h3>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
          <LegendItem color={C.pv} dashed label="Planeado" />
          <LegendItem color={C.ev} label="Valor ganado" />
          <LegendItem color={C.ac} label="Costo real" />
          {m.eac !== null && <LegendItem color={C.ac} dotted label="Proyección" />}
        </ul>
        <button onClick={() => setTable((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12px] font-medium text-ink-2 transition hover:text-ink" aria-pressed={table}>
          <Table2 size={13} /> {table ? "Ver gráfica" : "Ver tabla"}
        </button>
      </div>

      {table ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-[13px]">
            <thead>
              <tr className="text-[11px] tracking-wide text-ink-3 uppercase">
                <th className="py-2 font-medium">Fecha</th>
                <th className="py-2 text-right font-medium">Planeado</th>
                <th className="py-2 text-right font-medium">Valor ganado</th>
                <th className="py-2 text-right font-medium">Costo real</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {tableRows.map((p) => (
                <tr key={p.date} className="border-t border-line/60">
                  <td className="py-2 text-ink-2">{p.date === today ? "Hoy · " : ""}{formatDate(p.date)}</td>
                  <td className="py-2 text-right text-ink">{formatCOPMillions(p.pv)}</td>
                  <td className="py-2 text-right text-ink">{p.ev === null ? "—" : formatCOPMillions(p.ev)}</td>
                  <td className="py-2 text-right text-ink">{p.ac === null ? "—" : formatCOPMillions(p.ac)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 h-[300px] sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 22, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={axisDate} tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} minTickGap={56} interval="preserveStartEnd" padding={{ left: 4, right: 14 }} />
              <YAxis tickFormatter={axisM} tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} width={60} tickCount={5} domain={[0, Math.ceil(top * 1.05)]} />
              <ReferenceLine y={m.bac} stroke="var(--ink-3)" strokeOpacity={0.4} strokeDasharray="2 4" label={{ value: "Valor base", position: "insideBottomRight", fontSize: 11, fill: "var(--ink-3)" }} />
              <ReferenceLine x={new Date(`${today}T00:00:00`).getTime()} stroke="var(--ink-3)" strokeOpacity={0.5} label={{ value: "Hoy", position: "insideTopLeft", fontSize: 11, fill: "var(--ink-2)" }} />
              <Tooltip
                cursor={{ stroke: "var(--ink-3)", strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const p = active && payload?.[0]?.payload;
                  if (!p) return null;
                  return (
                    <div className="min-w-[190px] rounded-[12px] bg-white px-3 py-2.5 text-[12px] shadow-[var(--shadow-md)] ring-1 ring-line">
                      <p className="mb-1.5 font-medium text-ink">{formatDate(p.date)}</p>
                      <Row2 color={C.pv} label="Planeado" v={p.pv} />
                      {p.ev !== null && <Row2 color={C.ev} label="Valor ganado" v={p.ev} />}
                      {p.ac !== null && <Row2 color={C.ac} label="Costo real" v={p.ac} />}
                      {p.ev === null && p.forecast !== null && <Row2 color={C.ac} label="Proyección" v={p.forecast} />}
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="pv" stroke={C.pv} strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={{ r: 4, fill: C.pv, stroke: "#fff", strokeWidth: 2 }} isAnimationActive animationDuration={900} />
              <Line type="monotone" dataKey="forecast" stroke={C.ac} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" dot={false} activeDot={false} connectNulls isAnimationActive animationDuration={1200} animationBegin={500} />
              <Line type="monotone" dataKey="ac" stroke={C.ac} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: C.ac, stroke: "#fff", strokeWidth: 2 }} connectNulls={false} isAnimationActive animationDuration={1100} />
              <Line type="monotone" dataKey="ev" stroke={C.ev} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: C.ev, stroke: "#fff", strokeWidth: 2 }} connectNulls={false} isAnimationActive animationDuration={1100} animationBegin={150} />
              {last && <ReferenceDot x={last.t} y={m.ev} r={5} fill={C.ev} stroke="#fff" strokeWidth={2} ifOverflow="extendDomain" />}
              {last && <ReferenceDot x={last.t} y={m.ac} r={5} fill={C.ac} stroke="#fff" strokeWidth={2} ifOverflow="extendDomain" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {!table && (
        <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-ink-3">
          <CircleHelp size={14} className="mt-px shrink-0" />
          Si la línea azul (lo gastado) está por encima de la verde (lo construido), estás gastando más de lo que vale el avance.
          {hasOpening && " El consumo previo se reparte de forma pareja entre el inicio de obra y hoy, porque no tiene fecha exacta."}
        </p>
      )}
    </section>
  );
}

function LegendItem({ color, label, dashed, dotted }: { color: string; label: string; dashed?: boolean; dotted?: boolean }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <svg width="22" height="6" aria-hidden>
        <line x1="1" y1="3" x2="21" y2="3" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dashed ? "5 4" : dotted ? "1 5" : undefined} />
      </svg>
      {label}
    </li>
  );
}
function Row2({ color, label, v }: { color: string; label: string; v: number }) {
  return (
    <p className="flex items-center justify-between gap-4 py-0.5">
      <span className="inline-flex items-center gap-1.5 text-ink-2">
        <i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="tabular font-semibold text-ink">{formatCOP(v)}</span>
    </p>
  );
}

// ── Índices (medidores) ─────────────────────────────────────────────────
function Indicators({ m }: { m: EvmMetrics }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Gauge title="Índice de costo" short="CPI" value={m.cpi} good={(v) => `Cada $1 gastado rinde ${pesos(v)} de obra`} help="Valor ganado ÷ costo real. Mayor a 1: se construye más de lo que se gasta." />
      <Gauge title="Índice de cronograma" short="SPI" value={m.spi} good={(v) => `Llevas el ${formatPct(v)} del ritmo planeado`} help="Valor ganado ÷ valor planeado. Mayor a 1: vas adelantado." />
    </div>
  );
}

function Gauge({ title, short, value, good, help }: { title: string; short: string; value: number | null; good: (v: number) => string; help: string }) {
  const tone = indexTone(value);
  const t = TONE[tone];
  const MAX = 1.5;
  const frac = value === null ? 0 : Math.min(1, value / MAX);
  const r = 70;
  const cx = 100;
  const cy = 88;
  const arc = (f: number) => {
    const a = Math.PI * (1 - f);
    return `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`;
  };
  const path = `M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}`;
  const len = Math.PI * r;
  const tickA = Math.PI * (1 - 1 / MAX); // marca del 1,0 (en línea con el plan)
  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-line/70">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-ink">
          {title} <span className="font-normal text-ink-3">· {short}</span>
        </h3>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: t.fg, backgroundColor: t.bg }}>
          {t.label}
        </span>
      </div>
      <div className="relative mx-auto mt-2 w-full max-w-[220px]">
        <svg viewBox="0 0 200 104" className="w-full overflow-visible" role="img" aria-label={`${title}: ${value === null ? "sin datos" : value.toFixed(2)}`}>
          <path d={path} fill="none" stroke="var(--surface-3)" strokeWidth="12" strokeLinecap="round" />
          <motion.path d={path} fill="none" stroke={ARC[tone]} strokeWidth="12" strokeLinecap="round" strokeDasharray={len} initial={{ strokeDashoffset: len }} animate={{ strokeDashoffset: len * (1 - frac) }} transition={{ duration: 1.5, delay: 0.3, ease: EXPO }} />
          <line x1={cx + (r - 11) * Math.cos(tickA)} y1={cy - (r - 11) * Math.sin(tickA)} x2={cx + (r + 11) * Math.cos(tickA)} y2={cy - (r + 11) * Math.sin(tickA)} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
          <text x={cx + (r + 17) * Math.cos(tickA)} y={cy - (r + 17) * Math.sin(tickA) + 3} fontSize="9" fill="var(--ink-2)" textAnchor="start">1,0</text>
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="tabular text-[30px] leading-none font-semibold tracking-[-0.03em] text-ink">{value === null ? "—" : <AnimatedNumber value={value} format={(n) => n.toFixed(2).replace(".", ",")} />}</p>
        </div>
      </div>
      <p className="mt-3 text-center text-[13px] font-medium text-ink">{value === null ? "Sin datos suficientes" : good(value)}</p>
      <p className="mt-1 text-center text-[11px] leading-snug text-ink-3">{help}</p>
    </section>
  );
}

// ── Cifras ──────────────────────────────────────────────────────────────
function Figures({ m }: { m: EvmMetrics }) {
  const items: { label: string; value: number | null; hint: string; signed?: boolean }[] = [
    { label: "Valor ganado", value: m.ev, hint: "Lo que vale lo construido" },
    { label: "Costo real", value: m.ac, hint: "Lo gastado hasta hoy" },
    { label: "Variación de costo", value: m.cv, hint: "Ganado − gastado", signed: true },
    { label: "Variación de cronograma", value: m.sv, hint: "Ganado − planeado", signed: true },
    { label: "Estimado al terminar", value: m.eac, hint: "Costo final si todo sigue igual" },
    { label: "Falta por gastar", value: m.etc, hint: "Para terminar al ritmo actual" },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((it, i) => (
        <motion.div key={it.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 + i * 0.05, ease: EXPO }} className="rounded-[18px] bg-white p-4 ring-1 ring-line/70">
          <p className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">{it.label}</p>
          <p className={cn("tabular mt-1.5 text-[20px] font-semibold tracking-[-0.02em]", it.signed && it.value !== null ? (it.value < 0 ? "text-danger" : "text-[#13704a]") : "text-ink")}>
            {it.value === null ? "—" : `${it.signed && it.value > 0 ? "+" : it.signed && it.value < 0 ? "−" : ""}${formatCOPMillions(Math.abs(it.value))}`}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-3">{it.hint}</p>
        </motion.div>
      ))}
    </section>
  );
}

// ── Registro de avance ──────────────────────────────────────────────────
function FirstRecord({ autoPct, canEdit }: { autoPct: number; canEdit: boolean }) {
  const add = useProgress((s) => s.add);
  return (
    <section className="rounded-[24px] bg-[#0f2a20] p-6 text-white sm:p-8">
      <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-white/10">
        <TrendingUp size={22} strokeWidth={1.7} />
      </span>
      <h3 className="mt-5 text-[26px] leading-tight font-semibold tracking-[-0.03em] sm:text-[32px]">¿Cuánto lleva realmente la obra?</h3>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/70">El valor ganado compara lo que se ha gastado con lo que realmente se ha construido. Para calcularlo, registra el avance real de la obra con la fecha (por ejemplo, &quot;hoy: 45 %&quot;). Puedes ir añadiendo registros con el tiempo y la gráfica se arma sola.</p>
      {canEdit && autoPct > 0 && (
        <button onClick={() => void add({ date: todayISO(), pct: autoPct, note: "Avance según las actividades" })} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-[#0f2a20] transition hover:bg-accent-soft">
          Usar el avance por actividades ({formatPct(autoPct)}) <ArrowRight size={16} />
        </button>
      )}
      <p className="mt-4 text-[12px] text-white/50">{autoPct > 0 ? "O ingresa el avance real en «Registro de avance real»." : "Ingresa el avance real en «Registro de avance real»."}</p>
    </section>
  );
}

function ProgressLog({ canEdit, autoPct, hasEntries }: { canEdit: boolean; autoPct: number; hasEntries: boolean }) {
  const entries = useProgress((s) => s.entries);
  const add = useProgress((s) => s.add);
  const remove = useProgress((s) => s.remove);
  const [pct, setPct] = useState(() => Math.round(((entries[entries.length - 1]?.pct ?? autoPct) || 0) * 1000) / 10);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = [...entries].reverse();
  const last = entries[entries.length - 1];

  const submit = async () => {
    setBusy(true);
    const ok = await add({ date, pct: pct / 100, note });
    setBusy(false);
    if (ok) setNote("");
  };

  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-line/70 sm:p-6">
      <h3 className="text-[15px] font-semibold text-ink">Registro de avance real</h3>
      <p className="mt-0.5 text-[12px] text-ink-2">Cada registro dice: &quot;a esta fecha la obra llevaba X %&quot;.</p>
      {canEdit && (
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1.5 flex items-end justify-between">
              <span className="text-[12px] font-medium text-ink-2">Avance acumulado</span>
              <label className="flex items-center gap-1">
                <input inputMode="decimal" value={String(pct).replace(".", ",")} onChange={(e) => setPct(digitsPct(e.target.value))} className="tabular h-8 w-16 rounded-[10px] border border-line bg-white px-2 text-right text-[15px] font-semibold text-ink outline-none focus:border-accent" aria-label="Porcentaje de avance" />
                <span className="text-[15px] font-semibold text-ink">%</span>
              </label>
            </div>
            <input type="range" min={0} max={100} step={0.5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-[#1b7a50]" aria-label="Avance acumulado" />
            {last && pct < last.pct * 100 && <p className="mt-1 text-[11px] text-[#7c5314]">Es menor que el último registro ({formatPct(last.pct)}). Verifica que sea correcto.</p>}
          </div>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_150px]">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="Nota (opcional)" className={cn(inputCls, "h-10 text-[16px]")} />
            <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "block h-10 w-full min-w-0 max-w-full appearance-none px-3 text-[16px]")} aria-label="Fecha del avance" />
          </div>
          <button onClick={() => void submit()} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-brand text-[14px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
            <Plus size={16} /> {busy ? "Guardando…" : "Registrar avance"}
          </button>
          {!hasEntries ? null : autoPct > 0 && (
            <p className="text-center text-[11px] text-ink-3">Por actividades la app calcula {formatPct(autoPct)} de avance.</p>
          )}
        </div>
      )}
      <ul className="mt-4 divide-y divide-line/60">
        <AnimatePresence initial={false}>
          {rows.map((e) => (
            <motion.li key={e.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease: EXPO }} className="group flex items-center gap-3 py-2.5">
              <span className="tabular grid h-10 w-14 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-[14px] font-semibold text-brand">{formatPct(e.pct)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink">{formatDate(e.date)}</span>
                {e.note && <span className="block truncate text-[12px] text-ink-2">{e.note}</span>}
              </span>
              {canEdit && (
                <button onClick={() => void remove(e.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-danger-soft hover:text-danger sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Eliminar el registro del ${formatDate(e.date)}`}>
                  <Trash2 size={14} />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        {!rows.length && <li className="py-4 text-center text-[12px] text-ink-3">Aún no hay registros.</li>}
      </ul>
    </section>
  );
}

function Term({ k, children }: { k: string; children: ReactNode }) {
  return (
    <li>
      <strong className="text-ink">{k}.</strong> {children}
    </li>
  );
}

function HowToRead() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-[24px] bg-white ring-1 ring-line/70">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 px-5 py-4 text-left sm:px-6">
        <CircleHelp size={16} className="text-brand" />
        <span className="flex-1 text-[14px] font-semibold text-ink">¿Cómo se lee esto?</span>
        <ChevronDown size={16} className={cn("text-ink-3 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EXPO }} className="overflow-hidden">
            <ul className="space-y-2.5 px-5 pb-5 text-[13px] leading-relaxed text-ink-2 sm:px-6">
              <Term k="Planeado">cuánto debería llevar ejecutado hoy según el cronograma.</Term>
              <Term k="Valor ganado">cuánto vale la obra realmente hecha: avance real × valor del proyecto.</Term>
              <Term k="Costo real">lo que se ha gastado (solo los gastos que cuentan en el presupuesto).</Term>
              <Term k="Índice de costo">valor ganado ÷ costo real. 1,00 es ir perfecto; 0,80 significa que cada $1 rinde $0,80.</Term>
              <Term k="Índice de cronograma">valor ganado ÷ planeado. Menos de 1 es atraso.</Term>
              <Term k="Estimado al terminar">el valor base ÷ índice de costo: lo que costaría terminar si el rendimiento no mejora.</Term>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
