"use client";

import { Compass, DraftingCompass, HardHat, Layers, PaintRoller, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import type { ConstructionStage, CostCategory, MaterialUnit, Priority, Project } from "@/types";
import type { ProjectInput } from "@/lib/api";
import { COST_CATEGORY_LABEL, quoteTotals } from "@/lib/domain";
import { addDays, cn, formatCOP, formatDate, formatNumber, todayISO, uid } from "@/lib/format";
import { STAGE_TEMPLATE, TASK_SUGGESTIONS, stagesWeightTotal } from "@/lib/setup";
import { useProjectStore, sortedStages } from "@/stores/projectStore";
import { useUI } from "@/stores/uiStore";
import { GlassButton, StatusBadge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";
import { PRIORITY_LABEL } from "@/components/dashboard/StageDetailDrawer";

// ── Piezas de formulario ────────────────────────────────────────────────
const inputCls =
  "h-11 w-full rounded-[12px] border border-line bg-white px-3.5 text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/15 focus-visible:outline-none";

function Field({ label, hint, required, className, children }: { label: string; hint?: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-ink-2">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}

const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={cn(inputCls, props.className)} />;

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        <div className="ml-auto">{aside}</div>
      </div>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-[14px] border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-3">{children}</p>;
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-danger-soft hover:text-danger" aria-label={label}>
      <Trash2 size={15} />
    </button>
  );
}

const useActiveProject = () => useProjectStore((s) => s.projects.find((p) => p.id === s.projectId));

// ── 1. Información general ──────────────────────────────────────────────
const PROJECT_TYPES = ["Vivienda unifamiliar", "Vivienda multifamiliar", "Comercial", "Oficinas", "Industrial", "Institucional", "Infraestructura vial", "Remodelación", "Otro"];
const STRUCTURAL = ["Concreto reforzado", "Mampostería estructural", "Mampostería confinada", "Estructura metálica", "Madera", "Sistema mixto", "No aplica"];

/** Conserva valores guardados que no estén en la lista sugerida */
const withCurrent = (list: string[], v: string) => (v && !list.includes(v) ? [v, ...list] : list);

export function GeneralStep({ creating, onSaved }: { creating: boolean; onSaved: () => void }) {
  const project = useActiveProject();
  const projects = useProjectStore((s) => s.projects);
  const create = useProjectStore((s) => s.createProject);
  const update = useProjectStore((s) => s.updateProject);
  const toast = useUI((s) => s.toast);
  const base: Project | undefined = creating ? undefined : project;
  const today = todayISO();
  const [f, setF] = useState<ProjectInput>(() => ({
    code: base?.code ?? `RC-${String(projects.length + 1).padStart(3, "0")}`,
    name: base?.name ?? "",
    clientName: base?.clientName ?? "",
    description: base?.description ?? "",
    type: base?.type ?? "",
    city: base?.city ?? "",
    country: base?.country ?? "Colombia",
    builtAreaM2: base?.builtAreaM2 ?? 0,
    levels: base?.levels ?? 1,
    structuralSystem: base?.structuralSystem ?? "",
    status: base?.status ?? "active",
    startDate: base?.startDate ?? today,
    plannedEndDate: base?.plannedEndDate ?? addDays(today, 365),
  }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.plannedEndDate <= f.startDate) return toast({ title: "Revisa las fechas", description: "La fecha de entrega debe ser posterior al inicio.", tone: "warning" });
    setBusy(true);
    const ok = creating ? !!(await create(f)) : await update(f);
    setBusy(false);
    if (ok) {
      toast({ title: creating ? "Proyecto creado" : "Datos guardados", description: f.name });
      onSaved();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field label="Nombre del proyecto" required>
          <Input required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Residencia Los Almendros" maxLength={120} autoFocus />
        </Field>
        <Field label="Código" required hint="Identificador interno">
          <Input required value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={20} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente">
          <Input value={f.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Persona o empresa contratante" maxLength={120} />
        </Field>
        <Field label="Tipo de proyecto" required>
          <Select label="Tipo de proyecto" value={f.type} onChange={(v) => set("type", v)} placeholder="Selecciona…" options={withCurrent(PROJECT_TYPES, f.type).map((t) => ({ value: t, label: t }))} className="h-11" />
        </Field>
      </div>
      <Field label="Descripción del alcance">
        <textarea value={f.description} onChange={(e) => set("description", e.target.value)} className={cn(inputCls, "h-24 resize-none py-2.5")} placeholder="Qué se va a construir, alcance contratado y exclusiones." maxLength={1000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ciudad / municipio" required>
          <Input required value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Ej. Barranquilla" maxLength={80} />
        </Field>
        <Field label="País" required>
          <Input required value={f.country} onChange={(e) => set("country", e.target.value)} maxLength={60} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Área construida (m²)">
          <Input type="number" min={0} step="any" value={f.builtAreaM2 || ""} onChange={(e) => set("builtAreaM2", Math.max(0, Number(e.target.value)))} placeholder="0" />
        </Field>
        <Field label="Niveles">
          <Input type="number" min={1} max={200} value={f.levels} onChange={(e) => set("levels", Math.max(1, Math.round(Number(e.target.value))))} />
        </Field>
        <Field label="Sistema estructural">
          <Select label="Sistema estructural" value={f.structuralSystem} onChange={(v) => set("structuralSystem", v)} placeholder="Selecciona…" options={withCurrent(STRUCTURAL, f.structuralSystem).map((t) => ({ value: t, label: t }))} className="h-11" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha de inicio" required>
          <Input type="date" required value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label="Entrega prevista" required>
          <Input type="date" required value={f.plannedEndDate} onChange={(e) => set("plannedEndDate", e.target.value)} />
        </Field>
        <Field label="Estado">
          <Select
            label="Estado"
            value={f.status}
            onChange={(v) => set("status", v as Project["status"])}
            options={[
              { value: "active", label: "Activo" },
              { value: "paused", label: "Pausado" },
              { value: "closed", label: "Cerrado" },
            ]}
            className="h-11"
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <GlassButton type="submit" variant="primary" size="lg" disabled={busy || !f.type}>
          {busy ? "Guardando…" : creating ? "Crear proyecto y continuar" : "Guardar y continuar"}
        </GlassButton>
      </div>
    </form>
  );
}

// ── 2. Equipo ───────────────────────────────────────────────────────────
const ROLES = ["Director de proyecto", "Ingeniero residente", "Arquitecto", "Ingeniero estructural", "Topógrafo", "Presupuestos y APU", "Maestro de obra", "Interventor", "Almacenista", "SST"];

export function TeamStep() {
  const members = useProjectStore((s) => s.members);
  const add = useProjectStore((s) => s.addMember);
  const remove = useProjectStore((s) => s.removeMember);
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    if (await add({ name, role })) setName("");
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="grid gap-3 rounded-[18px] bg-surface-2/60 p-4 sm:grid-cols-[1fr_240px_auto] sm:items-end">
        <Field label="Nombre completo" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ing. Laura Mendoza" maxLength={100} autoFocus />
        </Field>
        <Field label="Cargo">
          <Select label="Cargo" value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: r }))} className="h-11" />
        </Field>
        <GlassButton type="submit" variant="primary" size="lg" icon={<Plus size={17} />} disabled={busy || !name.trim()}>
          Agregar
        </GlassButton>
      </form>
      <Section title={`Integrantes (${members.length})`}>
        {members.length === 0 ? (
          <EmptyNote>Agrega al menos una persona para poder asignar actividades.</EmptyNote>
        ) : (
          <ul className="divide-y divide-line/70 overflow-hidden rounded-[16px] ring-1 ring-line">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 bg-white px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e2ece6] text-[13px] font-semibold text-brand">{m.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{m.name}</span>
                  <span className="block text-[12px] text-ink-2">{m.role}</span>
                </span>
                <RemoveButton onClick={() => void remove(m.id)} label={`Quitar a ${m.name}`} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ── 3. Etapas ───────────────────────────────────────────────────────────
const ICONS: { value: ConstructionStage["icon"]; label: string; icon: typeof Compass }[] = [
  { value: "survey", label: "Estudios", icon: Compass },
  { value: "design", label: "Diseño", icon: DraftingCompass },
  { value: "build", label: "Obra", icon: HardHat },
  { value: "finish", label: "Acabados", icon: PaintRoller },
  { value: "generic", label: "Otra", icon: Layers },
];

export function StagesStep() {
  const stored = useProjectStore((s) => s.stages);
  const projectId = useProjectStore((s) => s.projectId);
  const save = useProjectStore((s) => s.saveStages);
  const removeStage = useProjectStore((s) => s.removeStage);
  const toast = useUI((s) => s.toast);
  const [rows, setRows] = useState<ConstructionStage[]>(() => sortedStages(stored));
  const [busy, setBusy] = useState(false);
  const total = stagesWeightTotal(rows);
  const dirty = JSON.stringify(rows) !== JSON.stringify(sortedStages(stored));

  const update = (id: string, patch: Partial<ConstructionStage>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addRow = () => setRows((r) => [...r, { id: uid("stg"), projectId, order: r.length + 1, name: "", icon: "generic", weight: 0 }]);
  const useTemplate = () => setRows(STAGE_TEMPLATE.map((t, i) => ({ id: uid("stg"), projectId, order: i + 1, name: t.name, icon: t.icon, weight: t.weight })));
  const drop = async (id: string) => {
    if (stored.some((s) => s.id === id)) {
      if (!(await removeStage(id))) return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
  };
  const submit = async () => {
    if (rows.some((r) => !r.name.trim())) return toast({ title: "Falta el nombre de alguna etapa", tone: "warning" });
    setBusy(true);
    if (await save(rows)) toast({ title: "Etapas guardadas", description: `${rows.length} etapas · ${total} %` });
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      {rows.length === 0 && (
        <div className="rounded-[18px] bg-accent-soft/60 p-5">
          <p className="text-[14px] font-medium text-ink">¿Empezamos con la plantilla estándar de obra?</p>
          <p className="mt-1 text-[13px] text-ink-2">Estudios 8 % · Diseño 12 % · Ejecución 62 % · Acabados 18 %. Puedes cambiar nombres y pesos.</p>
          <div className="mt-3 flex gap-2">
            <GlassButton variant="primary" size="md" icon={<Sparkles size={16} />} onClick={useTemplate}>
              Usar plantilla
            </GlassButton>
            <GlassButton variant="outline" size="md" icon={<Plus size={16} />} onClick={addRow}>
              Etapa en blanco
            </GlassButton>
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.id} className="grid items-center gap-2 rounded-[16px] bg-white p-3 ring-1 ring-line sm:grid-cols-[28px_1fr_150px_110px_32px]">
                <span className="tabular text-center text-[13px] font-semibold text-ink-3">{i + 1}</span>
                <Input value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="Nombre de la etapa" aria-label={`Nombre etapa ${i + 1}`} maxLength={80} />
                <Select label={`Tipo etapa ${i + 1}`} value={r.icon} onChange={(v) => update(r.id, { icon: v as ConstructionStage["icon"] })} options={ICONS.map((x) => ({ value: x.value, label: x.label }))} className="h-11" />
                <label className="flex items-center gap-1.5">
                  <Input type="number" min={0} max={100} step={0.5} value={Math.round(r.weight * 1000) / 10} onChange={(e) => update(r.id, { weight: Math.max(0, Number(e.target.value)) / 100 })} aria-label={`Peso etapa ${i + 1}`} className="text-right" />
                  <span className="text-[13px] text-ink-3">%</span>
                </label>
                <RemoveButton onClick={() => void drop(r.id)} label={`Eliminar etapa ${i + 1}`} />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <GlassButton variant="outline" size="md" icon={<Plus size={16} />} onClick={addRow}>
              Agregar etapa
            </GlassButton>
            <span className={cn("tabular text-[13px] font-medium", Math.abs(total - 100) < 0.5 ? "text-[#13704a]" : "text-warning")}>
              Suma de pesos: {formatNumber(total)} % {Math.abs(total - 100) < 0.5 ? "✓" : "· debe ser 100 %"}
            </span>
            <GlassButton variant="primary" size="md" className="ml-auto" onClick={() => void submit()} disabled={busy || !dirty}>
              {busy ? "Guardando…" : dirty ? "Guardar etapas" : "Guardado"}
            </GlassButton>
          </div>
          <p className="text-[12px] text-ink-3">Eliminar una etapa guardada borra también sus actividades.</p>
        </>
      )}
    </div>
  );
}

// ── 4. Actividades ──────────────────────────────────────────────────────
export function TasksStep() {
  const rawStages = useProjectStore((s) => s.stages);
  const stages = useMemo(() => sortedStages(rawStages), [rawStages]);
  const tasks = useProjectStore((s) => s.tasks);
  const members = useProjectStore((s) => s.members);
  const project = useActiveProject();
  const addTask = useProjectStore((s) => s.addTask);
  const removeTask = useProjectStore((s) => s.removeTask);
  const setStep = useUI((s) => s.setSetupStep);
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const stage = stages.find((s) => s.id === stageId) ?? stages[0];
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(() => addDays(project?.startDate ?? todayISO(), 14));
  const [priority, setPriority] = useState<Priority>("medium");

  if (!stages.length)
    return (
      <EmptyNote>
        Primero define las etapas.{" "}
        <button onClick={() => setStep("stages")} className="font-semibold text-brand underline-offset-4 hover:underline">
          Ir a Etapas
        </button>
      </EmptyNote>
    );

  const list = tasks.filter((t) => t.stageId === stage.id);
  const suggestions = TASK_SUGGESTIONS[stage.icon].filter((s) => !list.some((t) => t.title === s));
  const add = (t: string) => {
    if (!t.trim()) return;
    if (addTask(stage.id, { title: t.trim(), description: "", assigneeId, dueDate, priority })) setTitle("");
  };
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Sin asignar";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Etapa">
        {stages.map((s) => {
          const n = tasks.filter((t) => t.stageId === s.id).length;
          return (
            <button key={s.id} role="tab" aria-selected={s.id === stage.id} onClick={() => setStageId(s.id)} className={cn("h-9 rounded-full px-3.5 text-[13px] font-medium transition", s.id === stage.id ? "bg-brand text-white" : "bg-white text-ink-2 ring-1 ring-line hover:text-ink")}>
              {s.order}. {s.name} <span className={cn("ml-1 tabular", s.id === stage.id ? "text-white/70" : n ? "text-[#13704a]" : "text-warning")}>{n}</span>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(title);
        }}
        className="grid gap-3 rounded-[18px] bg-surface-2/60 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_190px_150px_150px_auto] lg:items-end"
      >
        <Field label="Actividad" required className="sm:col-span-2 lg:col-span-1">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Vaciado de zapatas eje A" maxLength={160} />
        </Field>
        <Field label="Responsable">
          <Select label="Responsable" value={assigneeId} onChange={setAssigneeId} placeholder={members.length ? "Selecciona…" : "Sin equipo"} options={members.map((m) => ({ value: m.id, label: m.name, hint: m.role }))} className="h-11" />
        </Field>
        <Field label="Fecha límite">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Prioridad">
          <Select label="Prioridad" value={priority} onChange={(v) => setPriority(v as Priority)} options={(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} className="h-11" />
        </Field>
        <GlassButton type="submit" variant="primary" size="lg" icon={<Plus size={17} />} disabled={!title.trim()}>
          Agregar
        </GlassButton>
      </form>

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
            <Sparkles size={13} /> Sugerencias para “{stage.name}” (clic para agregar con el responsable y la fecha de arriba)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => add(s)} className="h-8 rounded-full bg-white px-3 text-[12px] font-medium text-ink-2 ring-1 ring-line transition hover:text-brand hover:ring-accent">
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <Section title={`Actividades de “${stage.name}” (${list.length})`}>
        {list.length === 0 ? (
          <EmptyNote>Esta etapa aún no tiene actividades. Cada etapa necesita al menos una.</EmptyNote>
        ) : (
          <ul className="divide-y divide-line/70 overflow-hidden rounded-[16px] ring-1 ring-line">
            {list.map((t) => (
              <li key={t.id} className="flex items-center gap-3 bg-white px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{t.title}</span>
                  <span className="block text-[12px] text-ink-2">
                    {name(t.assigneeId)} · {formatDate(t.dueDate)} · {PRIORITY_LABEL[t.priority]}
                  </span>
                </span>
                <RemoveButton onClick={() => void removeTask(t.id)} label={`Eliminar ${t.title}`} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ── 5. Presupuesto y finanzas ───────────────────────────────────────────
export function BudgetStep() {
  const approved = useProjectStore((s) => s.approvedBudget);
  const expenses = useProjectStore((s) => s.expenses);
  const setBudget = useProjectStore((s) => s.setBudget);
  const addExpense = useProjectStore((s) => s.addExpense);
  const removeExpense = useProjectStore((s) => s.removeExpense);
  const toast = useUI((s) => s.toast);
  const [budget, setBudgetInput] = useState(approved || 0);
  const [exp, setExp] = useState({ date: todayISO(), concept: "", category: "materials" as CostCategory, amount: 0 });
  const executed = expenses.reduce((s, e) => s + (e.counts === false ? 0 : e.amount), 0);

  return (
    <div className="space-y-8">
      <Section title="Presupuesto aprobado">
        <div className="grid gap-3 rounded-[18px] bg-surface-2/60 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Valor total aprobado (COP)" hint={budget ? formatCOP(budget) : "Valor del contrato o presupuesto de obra"}>
            <Input type="number" min={0} step={1000} value={budget || ""} onChange={(e) => setBudgetInput(Math.max(0, Math.round(Number(e.target.value))))} placeholder="0" />
          </Field>
          <GlassButton
            variant="primary"
            size="lg"
            disabled={!budget || budget === approved}
            onClick={async () => {
              if (await setBudget(budget)) toast({ title: "Presupuesto guardado", description: formatCOP(budget) });
            }}
          >
            {budget === approved && approved ? "Guardado" : "Guardar presupuesto"}
          </GlassButton>
        </div>
        <p className="text-[12px] text-ink-3">La inversión planeada se reparte de forma lineal entre la fecha de inicio y la de entrega; sirve para medir la desviación del gasto.</p>
      </Section>

      <Section title={`Gastos ejecutados (${expenses.length})`} aside={<span className="tabular text-[13px] text-ink-2">Total: {formatCOP(executed)}</span>}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!exp.concept.trim() || exp.amount <= 0) return;
            if (await addExpense({ ...exp, concept: exp.concept.trim() })) setExp((x) => ({ ...x, concept: "", amount: 0 }));
          }}
          className="grid gap-3 rounded-[18px] bg-surface-2/60 p-4 sm:grid-cols-2 lg:grid-cols-[150px_1fr_160px_170px_auto] lg:items-end"
        >
          <Field label="Fecha">
            <Input type="date" value={exp.date} onChange={(e) => setExp((x) => ({ ...x, date: e.target.value }))} />
          </Field>
          <Field label="Concepto" required>
            <Input value={exp.concept} onChange={(e) => setExp((x) => ({ ...x, concept: e.target.value }))} placeholder="Ej. Anticipo de acero" maxLength={160} />
          </Field>
          <Field label="Categoría">
            <Select label="Categoría" value={exp.category} onChange={(v) => setExp((x) => ({ ...x, category: v as CostCategory }))} options={(Object.keys(COST_CATEGORY_LABEL) as CostCategory[]).map((c) => ({ value: c, label: COST_CATEGORY_LABEL[c] }))} className="h-11" />
          </Field>
          <Field label="Valor (COP)" required>
            <Input type="number" min={0} step={1000} value={exp.amount || ""} onChange={(e) => setExp((x) => ({ ...x, amount: Math.max(0, Math.round(Number(e.target.value))) }))} placeholder="0" />
          </Field>
          <GlassButton type="submit" variant="primary" size="lg" icon={<Plus size={17} />} disabled={!exp.concept.trim() || exp.amount <= 0}>
            Registrar
          </GlassButton>
        </form>
        {expenses.length === 0 ? (
          <EmptyNote>Sin gastos registrados. Puedes continuar y registrarlos a medida que ocurran.</EmptyNote>
        ) : (
          <ul className="divide-y divide-line/70 overflow-hidden rounded-[16px] ring-1 ring-line">
            {[...expenses].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-3 bg-white px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{e.concept}</span>
                  <span className="block text-[12px] text-ink-2">
                    {formatDate(e.date)} · {COST_CATEGORY_LABEL[e.category]}
                  </span>
                </span>
                <span className="tabular text-[14px] font-medium text-ink">{formatCOP(e.amount)}</span>
                <RemoveButton onClick={() => void removeExpense(e.id)} label={`Eliminar ${e.concept}`} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ── 6. Materiales e inventario ──────────────────────────────────────────
const UNITS: MaterialUnit[] = ["und", "kg", "m³", "m²", "ml", "bulto 50 kg"];

export function InventoryStep() {
  const materials = useProjectStore((s) => s.materials);
  const addMaterial = useProjectStore((s) => s.addMaterial);
  const removeMaterial = useProjectStore((s) => s.removeMaterial);
  const addMovement = useProjectStore((s) => s.addMovement);
  const [m, setM] = useState({ name: "", spec: "", unit: "und" as MaterialUnit, plannedQty: 0, unitPrice: 0, minStock: 0, supplier: "", received: 0 });
  const [mv, setMv] = useState({ materialId: "", type: "in" as "in" | "out", qty: 0, date: todayISO(), reference: "" });
  const [busy, setBusy] = useState(false);
  const plannedValue = useMemo(() => materials.reduce((s, x) => s + x.plannedQty * x.unitPrice, 0), [materials]);

  return (
    <div className="space-y-8">
      <Section title="Agregar material">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!m.name.trim()) return;
            setBusy(true);
            const ok = await addMaterial({ name: m.name.trim(), spec: m.spec.trim(), unit: m.unit, plannedQty: m.plannedQty, unitPrice: m.unitPrice, minStock: m.minStock, supplier: m.supplier.trim() }, m.received);
            setBusy(false);
            if (ok) setM((x) => ({ ...x, name: "", spec: "", plannedQty: 0, unitPrice: 0, minStock: 0, received: 0 }));
          }}
          className="grid gap-3 rounded-[18px] bg-surface-2/60 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Field label="Material" required className="lg:col-span-2">
            <Input value={m.name} onChange={(e) => setM((x) => ({ ...x, name: e.target.value }))} placeholder="Ej. Cemento gris" maxLength={120} />
          </Field>
          <Field label="Especificación">
            <Input value={m.spec} onChange={(e) => setM((x) => ({ ...x, spec: e.target.value }))} placeholder="Ej. Uso general" maxLength={120} />
          </Field>
          <Field label="Unidad">
            <Select label="Unidad" value={m.unit} onChange={(v) => setM((x) => ({ ...x, unit: v as MaterialUnit }))} options={UNITS.map((u) => ({ value: u, label: u }))} className="h-11" />
          </Field>
          <Field label="Cantidad prevista">
            <Input type="number" min={0} step="any" value={m.plannedQty || ""} onChange={(e) => setM((x) => ({ ...x, plannedQty: Math.max(0, Number(e.target.value)) }))} placeholder="0" />
          </Field>
          <Field label="Precio unitario (COP)">
            <Input type="number" min={0} step={100} value={m.unitPrice || ""} onChange={(e) => setM((x) => ({ ...x, unitPrice: Math.max(0, Math.round(Number(e.target.value))) }))} placeholder="0" />
          </Field>
          <Field label="Stock mínimo" hint="Alerta de abastecimiento">
            <Input type="number" min={0} step="any" value={m.minStock || ""} onChange={(e) => setM((x) => ({ ...x, minStock: Math.max(0, Number(e.target.value)) }))} placeholder="0" />
          </Field>
          <Field label="Ya en bodega" hint="Crea una entrada inicial">
            <Input type="number" min={0} step="any" value={m.received || ""} onChange={(e) => setM((x) => ({ ...x, received: Math.max(0, Number(e.target.value)) }))} placeholder="0" />
          </Field>
          <Field label="Proveedor" className="sm:col-span-2 lg:col-span-3">
            <Input value={m.supplier} onChange={(e) => setM((x) => ({ ...x, supplier: e.target.value }))} placeholder="Opcional" maxLength={120} />
          </Field>
          <div className="flex items-end">
            <GlassButton type="submit" variant="primary" size="lg" className="w-full justify-center" icon={<Plus size={17} />} disabled={busy || !m.name.trim()}>
              {busy ? "Guardando…" : "Agregar"}
            </GlassButton>
          </div>
        </form>
      </Section>

      <Section title={`Materiales (${materials.length})`} aside={<span className="tabular text-[13px] text-ink-2">Valor previsto: {formatCOP(plannedValue)}</span>}>
        {materials.length === 0 ? (
          <EmptyNote>Sin materiales. Si este proyecto no maneja inventario, usa “No aplica”.</EmptyNote>
        ) : (
          <ul className="divide-y divide-line/70 overflow-hidden rounded-[16px] ring-1 ring-line">
            {materials.map((x) => {
              const stock = x.receivedQty - x.consumedQty;
              const low = x.minStock > 0 && stock < x.minStock;
              return (
                <li key={x.id} className="flex items-center gap-3 bg-white px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{x.name}</span>
                    <span className="block text-[12px] text-ink-2">
                      Previsto {formatNumber(x.plannedQty)} {x.unit} · {formatCOP(x.unitPrice)}/{x.unit}
                    </span>
                  </span>
                  <span className="tabular text-right text-[13px] text-ink">
                    {formatNumber(stock)} {x.unit}
                    <span className="block text-[11px] text-ink-3">en bodega</span>
                  </span>
                  {low && <StatusBadge tone="warning">Stock bajo</StatusBadge>}
                  <RemoveButton onClick={() => void removeMaterial(x.id)} label={`Eliminar ${x.name}`} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {materials.length > 0 && (
        <Section title="Registrar entrada o salida de bodega">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!mv.materialId || mv.qty <= 0) return;
              if (await addMovement({ ...mv, reference: mv.reference.trim() })) setMv((x) => ({ ...x, qty: 0, reference: "" }));
            }}
            className="grid gap-3 rounded-[18px] bg-surface-2/60 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_130px_120px_150px_1fr_auto] lg:items-end"
          >
            <Field label="Material">
              <Select label="Material" value={mv.materialId} onChange={(v) => setMv((x) => ({ ...x, materialId: v }))} placeholder="Selecciona…" options={materials.map((x) => ({ value: x.id, label: `${x.name} (${x.unit})` }))} className="h-11" />
            </Field>
            <Field label="Tipo">
              <Select
                label="Tipo"
                value={mv.type}
                onChange={(v) => setMv((x) => ({ ...x, type: v as "in" | "out" }))}
                options={[
                  { value: "in", label: "Entrada" },
                  { value: "out", label: "Salida" },
                ]}
                className="h-11"
              />
            </Field>
            <Field label="Cantidad">
              <Input type="number" min={0} step="any" value={mv.qty || ""} onChange={(e) => setMv((x) => ({ ...x, qty: Math.max(0, Number(e.target.value)) }))} placeholder="0" />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={mv.date} onChange={(e) => setMv((x) => ({ ...x, date: e.target.value }))} />
            </Field>
            <Field label="Soporte">
              <Input value={mv.reference} onChange={(e) => setMv((x) => ({ ...x, reference: e.target.value }))} placeholder="Remisión o factura" maxLength={80} />
            </Field>
            <GlassButton type="submit" variant="primary" size="lg" disabled={!mv.materialId || mv.qty <= 0}>
              Registrar
            </GlassButton>
          </form>
        </Section>
      )}
    </div>
  );
}

// ── 7. Cotizaciones ─────────────────────────────────────────────────────
export function QuotesStep() {
  const quotes = useProjectStore((s) => s.quotes);
  const setQuick = useUI((s) => s.setQuickQuoteOpen);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-surface-2/60 p-4">
        <p className="flex-1 text-[13px] text-ink-2">Crea cotizaciones con ítems, AIU e IVA configurables. Se guardan en este proyecto.</p>
        <GlassButton variant="primary" size="lg" icon={<Plus size={17} />} onClick={() => setQuick(true)}>
          Crear cotización
        </GlassButton>
      </div>
      {quotes.length === 0 ? (
        <EmptyNote>Sin cotizaciones. Si aún no aplica, usa “No aplica” y créalas después desde el módulo Cotizaciones.</EmptyNote>
      ) : (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-[16px] ring-1 ring-line">
          {quotes.map((q) => (
            <li key={q.id} className="flex items-center gap-3 bg-white px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">
                  {q.code} · {q.title}
                </span>
                <span className="block text-[12px] text-ink-2">{q.clientName}</span>
              </span>
              <span className="tabular text-[14px] font-medium text-ink">{formatCOP(quoteTotals(q.items, q.adjustments).total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
