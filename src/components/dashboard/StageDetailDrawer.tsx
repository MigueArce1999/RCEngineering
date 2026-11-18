"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Select } from "@/components/ui/Select";
import { ArrowDown, ArrowUp, Box, Check, ChevronDown, MessageSquare, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Priority, Task, TaskStatus } from "@/types";
import { addDays, cn, formatDate, relativeDue, todayISO } from "@/lib/format";
import { STAGE_STATUS_LABEL } from "@/lib/domain";
import { useProjectData } from "@/hooks/useProjectData";
import { useProjectStore } from "@/stores/projectStore";
import { useUI } from "@/stores/uiStore";
import { members } from "@/data/demo";
import { ELEMENT_INDEX } from "@/lib/house/spec";
import { Drawer } from "@/components/ui/overlays";
import { Avatar, GlassButton, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { STAGE_ICONS } from "./StagePanel";

const FILTERS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "in_progress", label: "En proceso" },
  { key: "done", label: "Completadas" },
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { pending: "Pendiente", in_progress: "En proceso", done: "Completada" };
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
export const PRIORITY_TONE: Record<Priority, "neutral" | "info" | "warning" | "danger"> = { low: "neutral", medium: "info", high: "warning", critical: "danger" };

const PAGE = 30;

export function StageDetailDrawer() {
  const stageId = useUI((s) => s.stageDrawerId);
  const focusTaskId = useUI((s) => s.focusTaskId);
  const closeStage = useUI((s) => s.closeStage);
  const { stages, tasks, progressByStage } = useProjectData();
  // Conserva la última etapa mostrada para permitir la animación de cierre
  const [lastId, setLastId] = useState(stageId);
  if (stageId && stageId !== lastId) setLastId(stageId);
  const shownId = stageId ?? lastId;
  const stage = stages.find((s) => s.id === shownId);
  const progress = stage ? progressByStage[stage.id] : null;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  // Restablecer filtros al cambiar de etapa; enfocar actividad si viene de búsqueda/timeline
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const key = `${stageId}:${focusTaskId}`;
  if (key !== prevKey) {
    setPrevKey(key);
    setQuery("");
    setFilter("all");
    setExpanded(focusTaskId);
    setLimit(focusTaskId ? 100 : PAGE);
  }

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        t.stageId === shownId &&
        (filter === "all" || t.status === filter) &&
        (!q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    );
  }, [tasks, shownId, filter, query]);

  if (!stage || !progress) return null;
  const Icon = STAGE_ICONS[stage.icon];

  return (
    <Drawer
      open={!!stageId}
      onOpenChange={(v) => !v && closeStage()}
      width={600}
      title={<StageTitle stageId={stage.id} name={stage.name} order={stage.order} />}
      description={`Etapa ${stage.order} de ${stages.length} · peso en avance general ${Math.round(stage.weight * 100)} %`}
      header={
        <div className="space-y-4 px-6 pb-4">
          <div className="glass-brand flex items-center gap-4 rounded-[18px] p-4">
            <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-white/12 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
              <Icon size={21} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[13px] text-white/80">
                <span>{STAGE_STATUS_LABEL[progress.status]}</span>
                <span className="tabular font-medium text-white">{Math.round(progress.progress * 100)} %</span>
              </div>
              <ProgressBar value={progress.progress} tone="light" className="mt-2" label="Avance de la etapa" />
              <div className="tabular mt-2 flex gap-4 text-[12px] text-white/75">
                <span>{progress.done} completadas</span>
                <span>{progress.inProgress} en proceso</span>
                <span>{progress.pending} pendientes</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <label className="glass flex h-10 flex-1 items-center gap-2 rounded-full px-3.5 focus-within:ring-2 focus-within:ring-accent/40">
              <Search size={16} className="text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar actividad…"
                className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3 focus-visible:outline-none"
                aria-label="Buscar actividad"
              />
            </label>
            <div className="flex rounded-full bg-surface-2 p-1" role="tablist" aria-label="Filtrar por estado">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn("h-8 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap transition", filter === f.key ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <div className="border-t border-line/70 px-3 py-2">
        <p className="px-3 py-2 text-[12px] text-ink-3" aria-live="polite">
          {list.length} actividades
        </p>
        <ul className="space-y-1">
          {list.slice(0, limit).map((t) => (
            <TaskRow key={t.id} task={t} expanded={expanded === t.id} onToggleExpand={() => setExpanded((e) => (e === t.id ? null : t.id))} autoScroll={focusTaskId === t.id} />
          ))}
        </ul>
        {list.length > limit && (
          <div className="flex justify-center py-3">
            <GlassButton variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Mostrar más ({list.length - limit})
            </GlassButton>
          </div>
        )}
        <NewTaskForm stageId={stage.id} />
      </div>
    </Drawer>
  );
}

function StageTitle({ stageId, name, order }: { stageId: string; name: string; order: number }) {
  const rename = useProjectStore((s) => s.renameStage);
  const move = useProjectStore((s) => s.moveStage);
  const count = useProjectStore((s) => s.stages.length);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (editing)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) rename(stageId, value.trim());
          setEditing(false);
        }}
        className="flex items-center gap-2"
      >
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => setEditing(false)} className="h-9 flex-1 rounded-[10px] border border-line bg-white px-3 text-[16px] outline-none focus:border-accent" aria-label="Nombre de la etapa" />
      </form>
    );

  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate">{name}</span>
      <button onClick={() => { setValue(name); setEditing(true); }} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Renombrar etapa">
        <Pencil size={14} />
      </button>
      <button onClick={() => move(stageId, -1)} disabled={order <= 1} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-30" aria-label="Mover etapa antes">
        <ArrowUp size={14} />
      </button>
      <button onClick={() => move(stageId, 1)} disabled={order >= count} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-30" aria-label="Mover etapa después">
        <ArrowDown size={14} />
      </button>
    </span>
  );
}

function TaskRow({ task, expanded, onToggleExpand, autoScroll }: { task: Task; expanded: boolean; onToggleExpand: () => void; autoScroll: boolean }) {
  const toggle = useProjectStore((s) => s.toggleTaskDone);
  const setStatus = useProjectStore((s) => s.setTaskStatus);
  const addNote = useProjectStore((s) => s.addTaskNote);
  const focusElement = useUI((s) => s.focusElement);
  const closeStage = useUI((s) => s.closeStage);
  const toast = useUI((s) => s.toast);
  const assignee = members.find((m) => m.id === task.assigneeId);
  const [note, setNote] = useState("");
  const ref = useRef<HTMLLIElement>(null);
  const done = task.status === "done";

  useEffect(() => {
    if (autoScroll) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [autoScroll]);

  const submitNote = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    addNote(task.id, note.trim());
    setNote("");
  };

  return (
    <li ref={ref} className={cn("rounded-[16px] transition-colors", expanded ? "bg-surface-2/70" : "hover:bg-surface-2/50", autoScroll && "ring-1 ring-accent/50")}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button
          onClick={() => {
            toggle(task.id);
            toast({ title: done ? "Actividad reabierta" : "Actividad completada", description: task.title, tone: done ? "info" : "success" });
          }}
          className={cn(
            "mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border transition-all duration-150",
            done ? "border-brand bg-brand text-white" : task.status === "in_progress" ? "border-accent bg-accent-soft" : "border-line-strong bg-white hover:border-accent",
          )}
          aria-label={done ? `Marcar "${task.title}" como pendiente` : `Marcar "${task.title}" como completada`}
          aria-pressed={done}
        >
          {done && <Check size={13} strokeWidth={3} />}
        </button>
        <button onClick={onToggleExpand} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
          <p className={cn("text-[14px] leading-snug font-medium", done ? "text-ink-3 line-through" : "text-ink")}>{task.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-2">
            <span>{task.category}</span>
            <span aria-hidden>·</span>
            <span className={cn(!done && task.dueDate < todayISO() && "font-medium text-danger")}>{relativeDue(task.dueDate)}</span>
            {task.notes.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare size={12} /> {task.notes.length}
              </span>
            )}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge tone={PRIORITY_TONE[task.priority]} dot={false} className="hidden sm:inline-flex">
            {PRIORITY_LABEL[task.priority]}
          </StatusBadge>
          {assignee && <Avatar initials={assignee.initials} size={26} />}
          <ChevronDown size={16} className={cn("text-ink-3 transition-transform", expanded && "rotate-180")} />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="space-y-4 px-3 pb-4 pl-[46px]">
              <p className="text-[13px] leading-relaxed text-ink-2">{task.description}</p>
              <dl className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-3">
                <div>
                  <dt className="text-ink-3">Responsable</dt>
                  <dd className="mt-0.5 font-medium text-ink">{assignee?.name}</dd>
                  <dd className="text-ink-3">{assignee?.role}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Fecha límite</dt>
                  <dd className="mt-0.5 font-medium text-ink">{formatDate(task.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Prioridad</dt>
                  <dd className="mt-0.5 font-medium text-ink">{PRIORITY_LABEL[task.priority]}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-ink-3">Estado</span>
                {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(task.id, s)}
                    className={cn("h-7 rounded-full px-3 text-[12px] font-medium transition", task.status === s ? "bg-brand text-white" : "bg-white text-ink-2 ring-1 ring-line hover:text-ink")}
                  >
                    {TASK_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {task.elementIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-ink-3">Elementos 3D</span>
                  {task.elementIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        closeStage();
                        focusElement(id);
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] font-medium text-brand ring-1 ring-line transition hover:ring-accent"
                    >
                      <Box size={13} /> {id}
                      <span className="sr-only">{ELEMENT_INDEX[id]?.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div>
                <p className="mb-2 text-[12px] text-ink-3">Observaciones</p>
                {task.notes.length > 0 && (
                  <ul className="mb-2 space-y-1.5">
                    {task.notes.map((n) => (
                      <li key={n.id} className="rounded-[12px] bg-white px-3 py-2 text-[13px] text-ink ring-1 ring-line/70">
                        {n.text}
                        <span className="mt-0.5 block text-[11px] text-ink-3">{new Date(n.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={submitNote} className="flex gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar observación…" className="h-9 flex-1 rounded-[12px] border border-line bg-white px-3 text-[13px] outline-none focus:border-accent" aria-label="Nueva observación" />
                  <GlassButton type="submit" variant="outline" size="sm" disabled={!note.trim()}>
                    Agregar
                  </GlassButton>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function NewTaskForm({ stageId }: { stageId: string }) {
  const addTask = useProjectStore((s) => s.addTask);
  const toast = useUI((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(members[0].id);
  const [dueDate, setDueDate] = useState(() => addDays(todayISO(), 7));
  const [priority, setPriority] = useState<Priority>("medium");

  if (!open)
    return (
      <div className="px-3 py-3">
        <GlassButton variant="outline" size="sm" icon={<Plus size={15} />} onClick={() => setOpen(true)}>
          Nueva actividad
        </GlassButton>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        addTask(stageId, { title: title.trim(), description: "Actividad creada por el usuario.", assigneeId, dueDate, priority });
        toast({ title: "Actividad agregada", description: title.trim() });
        setTitle("");
        setOpen(false);
      }}
      className="m-3 space-y-3 rounded-[16px] bg-surface-2/70 p-4"
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre de la actividad" className="h-10 w-full rounded-[12px] border border-line bg-white px-3 text-[14px] outline-none focus:border-accent" aria-label="Nombre de la actividad" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select label="Responsable" className="text-[13px]" value={assigneeId} onChange={setAssigneeId} options={members.map((m) => ({ value: m.id, label: m.name, hint: m.role }))} />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 rounded-[12px] border border-line bg-white px-3 text-[13px] text-ink outline-none focus:border-accent" aria-label="Fecha límite" />
        <Select label="Prioridad" className="text-[13px]" value={priority} onChange={(v) => setPriority(v as Priority)} options={(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => ({ value: p, label: `Prioridad ${PRIORITY_LABEL[p].toLowerCase()}` }))} />
      </div>
      <div className="flex justify-end gap-2">
        <GlassButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </GlassButton>
        <GlassButton type="submit" variant="primary" size="sm" disabled={!title.trim()}>
          Agregar actividad
        </GlassButton>
      </div>
    </form>
  );
}
