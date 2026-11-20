"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CloudOff, Download, FileText, Loader2, Plus, RotateCcw, Trash2, UserPlus, Users, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import type { PayrollEntry, PayrollKind, PayrollPeriod, Worker } from "@/types";
import { usePayroll } from "@/stores/payrollStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUI } from "@/stores/uiStore";
import { useAuth } from "@/stores/authStore";
import { KIND_LABEL, WORKER_ROLES, entrySubtotal, entryTotal, payrollCSV, periodDays, periodSummary, periodTitle } from "@/lib/payroll";
import { cn, formatCOP, formatDate, formatNumber, todayISO, uid } from "@/lib/format";
import { GlassButton, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

const APPLE = [0.32, 0.72, 0, 1] as const;
const inputCls =
  "h-10 w-full rounded-[12px] border border-line bg-white px-3 text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/15 focus-visible:outline-none disabled:bg-surface-2 disabled:text-ink-2";
const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={cn(inputCls, props.className)} />;
const num = (v: string) => Math.max(0, Number(v) || 0);

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}

/** Módulo de nómina de obra: trabajadores y liquidaciones quincenales/mensuales. */
export function PayrollPanel() {
  const open = useUI((s) => s.module === "payroll");
  const openModule = useUI((s) => s.openModule);
  const projectName = useProjectStore((s) => s.projects.find((p) => p.id === s.projectId)?.name ?? "");
  const [tab, setTab] = useState<"periods" | "workers">("periods");

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && openModule("home")}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-[#0b1f17]/35 backdrop-blur-[6px]" />
        <Dialog.Content className="anim-modal fixed top-1/2 left-1/2 z-50 flex h-[min(94dvh,940px)] w-[calc(100vw-16px)] max-w-[1280px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white shadow-[var(--shadow-lg)]">
          <header className="flex flex-wrap items-center gap-4 border-b border-line/70 px-6 py-4 sm:px-8">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-accent-soft text-brand">
              <Wallet size={21} strokeWidth={1.7} />
            </span>
            <div className="min-w-[180px] flex-1">
              <Dialog.Title className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Nómina de obra</Dialog.Title>
              <Dialog.Description className="text-[13px] text-ink-2">{projectName ? `${projectName} · ` : ""}pagos quincenales y mensuales</Dialog.Description>
            </div>
            <div className="order-last flex w-full rounded-full bg-surface-2 p-1 sm:order-none sm:w-auto" role="tablist" aria-label="Sección">
              {(
                [
                  ["periods", "Liquidaciones"],
                  ["workers", "Trabajadores"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("h-9 flex-1 rounded-full px-4 text-[13px] font-medium transition sm:flex-none", tab === k ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}>
                  {l}
                </button>
              ))}
            </div>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label="Cerrar nómina">
              <X size={18} />
            </Dialog.Close>
          </header>
          {open && <Body tab={tab} setTab={setTab} projectName={projectName} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ tab, setTab, projectName }: { tab: "periods" | "workers"; setTab: (t: "periods" | "workers") => void; projectName: string }) {
  const state = usePayroll((s) => s.state);
  const error = usePayroll((s) => s.error);
  const load = usePayroll((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "error")
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <p className="text-[14px] text-danger">No se pudo cargar la nómina: {error}</p>
          <GlassButton variant="outline" size="md" className="mt-3" onClick={() => void load()}>
            Reintentar
          </GlassButton>
        </div>
      </div>
    );
  if (state !== "ready")
    return (
      <div className="space-y-3 p-8">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  return tab === "workers" ? <WorkersView /> : <PeriodsView projectName={projectName} goWorkers={() => setTab("workers")} />;
}

// ── Trabajadores ────────────────────────────────────────────────────────
function WorkersView() {
  const workers = usePayroll((s) => s.workers);
  const saveWorker = usePayroll((s) => s.saveWorker);
  const removeWorker = usePayroll((s) => s.removeWorker);
  const [f, setF] = useState({ name: "", document: "", role: WORKER_ROLES[0], dailyRate: 0 });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true);
    if (await saveWorker({ ...f, active: true })) setF((x) => ({ ...x, name: "", document: "" }));
    setBusy(false);
  };

  return (
    <div className="scroll-thin flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
      <form onSubmit={submit} className="grid gap-3 rounded-[18px] bg-surface-2/60 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_170px_220px_190px_auto] lg:items-end">
        <Field label="Nombre completo">
          <Input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="Ej. José Martínez" maxLength={120} autoFocus />
        </Field>
        <Field label="Cédula (opcional)">
          <Input value={f.document} onChange={(e) => setF((x) => ({ ...x, document: e.target.value }))} inputMode="numeric" maxLength={20} />
        </Field>
        <Field label="Cargo">
          <Select label="Cargo" value={f.role} onChange={(v) => setF((x) => ({ ...x, role: v }))} options={WORKER_ROLES.map((r) => ({ value: r, label: r }))} />
        </Field>
        <Field label="Valor día (COP)">
          <Input type="number" min={0} step={1000} value={f.dailyRate || ""} onChange={(e) => setF((x) => ({ ...x, dailyRate: num(e.target.value) }))} placeholder="0" />
        </Field>
        <GlassButton type="submit" variant="primary" size="lg" icon={<UserPlus size={17} />} disabled={busy || !f.name.trim()}>
          Agregar
        </GlassButton>
      </form>

      {workers.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line-strong px-4 py-8 text-center text-[13px] text-ink-3">Agrega a los obreros, oficiales, maestros y almacenista del proyecto con su valor por día.</p>
      ) : (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-[16px] ring-1 ring-line">
          {workers.map((w) => (
            <WorkerRow key={w.id} worker={w} onSave={saveWorker} onRemove={() => void removeWorker(w.id)} />
          ))}
        </ul>
      )}
      <p className="text-[12px] text-ink-3">El valor día se usa como valor sugerido al crear cada liquidación; en la liquidación se puede ajustar sin cambiar el del trabajador.</p>
    </div>
  );
}

function WorkerRow({ worker, onSave, onRemove }: { worker: Worker; onSave: (w: Worker) => Promise<boolean>; onRemove: () => void }) {
  const [rate, setRate] = useState(worker.dailyRate);
  return (
    <li className={cn("grid items-center gap-3 bg-white px-4 py-3 sm:grid-cols-[1fr_200px_170px_auto]", !worker.active && "opacity-60")}>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-ink">{worker.name}</span>
        <span className="block text-[12px] text-ink-2">{worker.document ? `C.C. ${worker.document}` : "Sin cédula"}</span>
      </span>
      <Select size="sm" label={`Cargo de ${worker.name}`} value={worker.role} onChange={(v) => void onSave({ ...worker, role: v })} options={WORKER_ROLES.map((r) => ({ value: r, label: r }))} />
      <Input type="number" min={0} step={1000} value={rate || ""} onChange={(e) => setRate(num(e.target.value))} onBlur={() => rate !== worker.dailyRate && void onSave({ ...worker, dailyRate: rate })} aria-label={`Valor día de ${worker.name}`} className="h-9 text-right" />
      <span className="flex items-center gap-1">
        <button onClick={() => void onSave({ ...worker, active: !worker.active })} className={cn("h-8 rounded-full px-3 text-[12px] font-medium transition", worker.active ? "bg-accent-soft text-[#13704a]" : "bg-surface-2 text-ink-3")}>
          {worker.active ? "Activo" : "Inactivo"}
        </button>
        <button onClick={onRemove} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 transition hover:bg-danger-soft hover:text-danger" aria-label={`Eliminar a ${worker.name}`}>
          <Trash2 size={15} />
        </button>
      </span>
    </li>
  );
}

// ── Liquidaciones ───────────────────────────────────────────────────────
function PeriodsView({ projectName, goWorkers }: { projectName: string; goWorkers: () => void }) {
  const periods = usePayroll((s) => s.periods);
  const workers = usePayroll((s) => s.workers);
  const createPeriod = usePayroll((s) => s.createPeriod);
  const [selected, setSelected] = useState<string | null>(periods[0]?.id ?? null);
  const [kind, setKind] = useState<PayrollKind>("biweekly");
  const [date, setDate] = useState(todayISO());
  const current = periods.find((p) => p.id === selected) ?? periods[0];

  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-b border-line/70 bg-surface-2/40 md:w-[320px] md:border-r md:border-b-0">
        <div className="space-y-2.5 p-4">
          <p className="text-[13px] font-semibold text-ink">Nueva liquidación</p>
          <div className="flex rounded-full bg-white p-1 ring-1 ring-line" role="radiogroup" aria-label="Tipo de periodo">
            {(Object.keys(KIND_LABEL) as PayrollKind[]).map((k) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("h-8 flex-1 rounded-full text-[13px] font-medium transition", kind === k ? "bg-brand text-white" : "text-ink-2 hover:text-ink")}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha dentro del periodo" className="h-10" />
            <GlassButton
              variant="primary"
              size="md"
              icon={<Plus size={16} />}
              onClick={async () => {
                const id = await createPeriod(kind, date);
                if (id) setSelected(id);
              }}
            >
              Crear
            </GlassButton>
          </div>
          <p className="text-[11px] text-ink-3">{kind === "biweekly" ? "Quincena 1–15 o 16–fin de mes según la fecha." : "Mes completo según la fecha."} Se precargan los trabajadores activos.</p>
        </div>
        <div className="hairline" />
        <ul className="scroll-thin max-h-56 min-h-0 flex-1 space-y-1 overflow-y-auto p-2 md:max-h-none">
          {periods.map((p) => {
            const total = periodSummary(p.entries).total;
            return (
              <li key={p.id}>
                <button onClick={() => setSelected(p.id)} className={cn("w-full rounded-[14px] px-3 py-2.5 text-left transition", p.id === current?.id ? "bg-white shadow-[var(--shadow-sm)] ring-1 ring-line" : "hover:bg-white/70")}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink first-letter:uppercase">{periodTitle(p)}</span>
                    <StatusBadge tone={p.status === "paid" ? "success" : "warning"}>{p.status === "paid" ? "Pagada" : "Borrador"}</StatusBadge>
                  </span>
                  <span className="mt-0.5 flex justify-between text-[12px] text-ink-2">
                    <span>
                      {KIND_LABEL[p.kind]} · {p.entries.length} trab.
                    </span>
                    <span className="tabular font-medium text-ink">{formatCOP(total)}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {periods.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-3">Aún no hay liquidaciones.</li>}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-col md:min-h-0 md:flex-1">
        {workers.length === 0 && periods.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div className="max-w-sm">
              <Users className="mx-auto text-brand/70" size={34} strokeWidth={1.5} />
              <p className="mt-3 text-[15px] font-semibold text-ink">Primero registra a los trabajadores</p>
              <p className="mt-1 text-[13px] text-ink-2">Nombre, cargo (obrero, oficial, maestro, almacenista…) y valor por día.</p>
              <GlassButton variant="primary" size="md" className="mt-4" icon={<UserPlus size={16} />} onClick={goWorkers}>
                Registrar trabajadores
              </GlassButton>
            </div>
          </div>
        ) : current ? (
          <AnimatePresence mode="wait">
            <motion.div key={current.id} className="flex flex-col md:min-h-0 md:flex-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: APPLE }}>
              <PeriodEditor period={current} projectName={projectName} onDeleted={() => setSelected(null)} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center text-[14px] text-ink-2">Crea la primera liquidación con el panel de la izquierda.</div>
        )}
      </section>
    </div>
  );
}

function SaveStatus({ saving, pending, error, onRetry }: { saving: boolean; pending: boolean; error: boolean; onRetry: () => void }) {
  if (error && !saving)
    return (
      <button onClick={onRetry} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-danger hover:bg-danger-soft">
        <CloudOff size={15} /> No se guardó · reintentar
      </button>
    );
  return (
    <span className="inline-flex h-10 items-center gap-1.5 px-2 text-[13px] text-ink-2" aria-live="polite">
      {saving || pending ? (
        <>
          <Loader2 size={15} className="animate-spin" /> Guardando…
        </>
      ) : (
        <>
          <Check size={15} className="text-accent" /> Guardado automáticamente
        </>
      )}
    </span>
  );
}

function PeriodEditor({ period, projectName, onDeleted }: { period: PayrollPeriod; projectName: string; onDeleted: () => void }) {
  const workers = usePayroll((s) => s.workers);
  const saveEntries = usePayroll((s) => s.saveEntries);
  const removePeriod = usePayroll((s) => s.removePeriod);
  const pay = usePayroll((s) => s.pay);
  const reopen = usePayroll((s) => s.reopen);
  const toast = useUI((s) => s.toast);
  const [rows, setRows] = useState<PayrollEntry[]>(period.entries);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === s.projectId));
  const preparedBy = useAuth((s) => (s.profile ? `${s.profile.firstName} ${s.profile.lastName}`.trim() : ""));
  const [paidAt, setPaidAt] = useState(todayISO());
  const [confirmPay, setConfirmPay] = useState(false);
  const locked = period.status === "paid";
  const maxDays = periodDays(period);
  const dirty = JSON.stringify(rows) !== JSON.stringify(period.entries);
  const sum = useMemo(() => periodSummary(rows), [rows]);
  const available = workers.filter((w) => w.active && !rows.some((r) => r.workerId === w.id));

  const update = (id: string, patch: Partial<PayrollEntry>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addWorker = (w: Worker) => setRows((r) => [...r, { id: uid("pye"), workerId: w.id, workerName: w.name, role: w.role, days: 0, dailyRate: w.dailyRate, extras: 0, deductions: 0 }]);
  // ── Guardado automático ──
  // Cada cambio se guarda solo ~0,7 s después; los guardados se encadenan (nunca en paralelo)
  // y lo pendiente se guarda también al cerrar el módulo o cambiar de periodo.
  const latest = useRef(rows);
  const inFlight = useRef(false);
  const again = useRef(false);
  const flush = useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    setSaving(true);
    let ok = true;
    do {
      again.current = false;
      ok = await saveEntries(period.id, latest.current);
    } while (again.current && ok);
    inFlight.current = false;
    setSaving(false);
    setSaveError(!ok);
  }, [period.id, saveEntries]);

  useEffect(() => {
    latest.current = rows;
    if (locked || !dirty) return;
    const id = window.setTimeout(() => void flush(), 700);
    return () => window.clearTimeout(id);
  }, [rows, dirty, locked, flush]);

  // Al desmontar (cerrar, cambiar de periodo) se guarda lo que haya quedado pendiente
  useEffect(() => {
    const periodId = period.id;
    return () => {
      const stored = usePayroll.getState().periods.find((p) => p.id === periodId);
      if (stored && stored.status === "draft" && JSON.stringify(stored.entries) !== JSON.stringify(latest.current)) void usePayroll.getState().saveEntries(periodId, latest.current);
    };
  }, [period.id]);

  // Aviso del navegador si se intenta salir con cambios sin guardar
  const pending = !locked && (dirty || saving);
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const exportPDF = async () => {
    setPdfBusy(true);
    try {
      const { downloadPayrollPdf } = await import("@/lib/payrollPdf");
      await downloadPayrollPdf({
        period,
        entries: rows,
        workers,
        project: { name: project?.name ?? projectName, code: project?.code ?? "", clientName: project?.clientName, city: project?.city },
        preparedBy,
      });
    } catch (e) {
      toast({ title: "No se pudo generar el PDF", description: (e as Error).message, tone: "warning" });
    }
    setPdfBusy(false);
  };
  const exportCSV = () => {
    const blob = new Blob([payrollCSV({ ...period, entries: rows }, projectName)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nomina-${period.startDate}-${period.kind === "monthly" ? "mensual" : "quincenal"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="flex flex-wrap items-start gap-3 px-6 pt-5 pb-4 sm:px-8">
        <div className="min-w-[240px] flex-1">
          <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-ink first-letter:uppercase">{periodTitle(period)}</h3>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {KIND_LABEL[period.kind]} · {formatDate(period.startDate)} – {formatDate(period.endDate)} · {maxDays} días calendario
            {locked && period.paidAt && ` · pagada el ${formatDate(period.paidAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton variant="primary" size="sm" icon={<FileText size={15} />} onClick={() => void exportPDF()} disabled={pdfBusy}>
            {pdfBusy ? "Generando…" : "Descargar PDF"}
          </GlassButton>
          <GlassButton variant="outline" size="sm" icon={<Download size={15} />} onClick={exportCSV}>
            Excel (CSV)
          </GlassButton>
          {locked ? (
            <GlassButton variant="outline" size="sm" icon={<RotateCcw size={15} />} onClick={async () => (await reopen(period.id)) && toast({ title: "Liquidación reabierta", description: "Se eliminó el gasto registrado en Finanzas.", tone: "info" })}>
              Reabrir
            </GlassButton>
          ) : (
            <GlassButton
              variant="danger"
              size="sm"
              icon={<Trash2 size={15} />}
              onClick={async () => {
                if (await removePeriod(period.id)) {
                  toast({ title: "Liquidación eliminada", tone: "info" });
                  onDeleted();
                }
              }}
            >
              Eliminar
            </GlassButton>
          )}
        </div>
      </div>

      {/* Tabla de liquidación */}
      <div className="scroll-thin px-6 pb-4 sm:px-8 md:min-h-0 md:flex-1 md:overflow-y-auto">
        <div className="hidden grid-cols-[1fr_84px_140px_130px_130px_150px_32px] gap-2 px-3 pb-2 text-[11px] font-medium tracking-wide text-ink-3 uppercase lg:grid">
          <span>Trabajador</span>
          <span className="text-right">Días</span>
          <span className="text-right">Valor día</span>
          <span className="text-right">Extras</span>
          <span className="text-right">Descuentos</span>
          <span className="text-right">Total</span>
          <span />
        </div>
        <ul className="space-y-2">
          {rows.map((r) => {
            const total = entryTotal(r);
            return (
              <li key={r.id} className="grid items-center gap-2 rounded-[16px] bg-white p-3 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-[1fr_84px_140px_130px_130px_150px_32px]">
                <span className="min-w-0 sm:col-span-2 lg:col-span-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{r.workerName}</span>
                  <span className="block text-[12px] text-ink-2">{r.role}</span>
                </span>
                <label className="flex items-center gap-2 lg:block">
                  <span className="w-24 text-[12px] text-ink-3 lg:hidden">Días</span>
                  <Input type="number" min={0} max={maxDays} step={0.5} value={r.days || ""} disabled={locked} onChange={(e) => update(r.id, { days: Math.min(maxDays, num(e.target.value)) })} placeholder="0" aria-label={`Días de ${r.workerName}`} className="h-9 text-right" />
                </label>
                <label className="flex items-center gap-2 lg:block">
                  <span className="w-24 text-[12px] text-ink-3 lg:hidden">Valor día</span>
                  <Input type="number" min={0} step={1000} value={r.dailyRate || ""} disabled={locked} onChange={(e) => update(r.id, { dailyRate: num(e.target.value) })} placeholder="0" aria-label={`Valor día de ${r.workerName}`} className="h-9 text-right" />
                </label>
                <label className="flex items-center gap-2 lg:block">
                  <span className="w-24 text-[12px] text-ink-3 lg:hidden">Extras</span>
                  <Input type="number" min={0} step={1000} value={r.extras || ""} disabled={locked} onChange={(e) => update(r.id, { extras: num(e.target.value) })} placeholder="0" aria-label={`Extras de ${r.workerName}`} className="h-9 text-right" />
                </label>
                <label className="flex items-center gap-2 lg:block">
                  <span className="w-24 text-[12px] text-ink-3 lg:hidden">Descuentos</span>
                  <Input type="number" min={0} step={1000} value={r.deductions || ""} disabled={locked} onChange={(e) => update(r.id, { deductions: num(e.target.value) })} placeholder="0" aria-label={`Descuentos de ${r.workerName}`} className="h-9 text-right" />
                </label>
                <span className="text-right">
                  <span className={cn("tabular block text-[15px] font-semibold", total < 0 ? "text-danger" : "text-ink")}>{formatCOP(total)}</span>
                  <span className="tabular block text-[11px] text-ink-3">
                    {formatNumber(r.days)} × {formatCOP(r.dailyRate)} = {formatCOP(entrySubtotal(r))}
                  </span>
                </span>
                {!locked ? (
                  <button onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} className="grid h-8 w-8 place-items-center justify-self-end rounded-full text-ink-3 transition hover:bg-danger-soft hover:text-danger" aria-label={`Quitar a ${r.workerName}`}>
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
        {!locked && available.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-ink-3">Agregar:</span>
            {available.map((w) => (
              <button key={w.id} onClick={() => addWorker(w)} className="h-8 rounded-full bg-white px-3 text-[12px] font-medium text-ink-2 ring-1 ring-line transition hover:text-brand hover:ring-accent">
                + {w.name}
              </button>
            ))}
          </div>
        )}
        {rows.length === 0 && <p className="rounded-[14px] border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-3">Sin trabajadores en esta liquidación.</p>}
      </div>

      {/* Totales */}
      <footer className="border-t border-line/70 bg-surface-2/50 px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <ul className="flex flex-1 flex-wrap gap-2">
            {sum.byRole.map((g) => (
              <li key={g.role} className="rounded-[12px] bg-white px-3 py-2 ring-1 ring-line">
                <p className="text-[11px] text-ink-3">
                  {g.role} · {g.workers}
                </p>
                <p className="tabular text-[13px] font-semibold text-ink">{formatCOP(g.total)}</p>
              </li>
            ))}
          </ul>
          <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-0.5 text-[12px] text-ink-2">
            <dt>Días trabajados</dt>
            <dd className="text-right text-ink">{formatNumber(sum.days)}</dd>
            <dt>Subtotal</dt>
            <dd className="text-right text-ink">{formatCOP(sum.subtotal)}</dd>
            <dt>Extras</dt>
            <dd className="text-right text-ink">+ {formatCOP(sum.extras)}</dd>
            <dt>Descuentos</dt>
            <dd className="text-right text-ink">− {formatCOP(sum.deductions)}</dd>
          </dl>
          <div className="text-right">
            <p className="text-[12px] font-medium text-ink-2">Total a pagar</p>
            <p className="tabular text-[30px] leading-none font-semibold tracking-[-0.02em] text-brand">
              <AnimatedNumber value={sum.total} format={formatCOP} />
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="mr-auto text-[11px] text-ink-3">No incluye aportes a seguridad social ni prestaciones sociales.</p>
          {!locked && (
            <>
              <SaveStatus saving={saving} pending={dirty} error={saveError} onRetry={() => void flush()} />
              {confirmPay ? (
                <span className="flex items-center gap-2 rounded-full bg-white py-1 pr-1 pl-3 ring-1 ring-line">
                  <span className="text-[12px] text-ink-2">Fecha de pago</span>
                  <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-8 rounded-full border border-line px-2 text-[13px]" aria-label="Fecha de pago" />
                  <GlassButton
                    variant="primary"
                    size="sm"
                    icon={<Check size={15} />}
                    onClick={async () => {
                      if (dirty && !(await saveEntries(period.id, rows))) return;
                      if (await pay(period.id, paidAt)) {
                        toast({ title: "Nómina pagada", description: `${formatCOP(sum.total)} registrado en Finanzas como mano de obra` });
                        setConfirmPay(false);
                      }
                    }}
                  >
                    Confirmar
                  </GlassButton>
                  <GlassButton variant="ghost" size="sm" onClick={() => setConfirmPay(false)}>
                    Cancelar
                  </GlassButton>
                </span>
              ) : (
                <GlassButton variant="primary" size="md" icon={<Wallet size={16} />} onClick={() => setConfirmPay(true)} disabled={sum.total <= 0}>
                  Marcar como pagada
                </GlassButton>
              )}
            </>
          )}
        </div>
      </footer>
    </>
  );
}
