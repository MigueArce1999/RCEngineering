/**
 * Capa de datos sobre Supabase. Convierte filas (snake_case) a los tipos de dominio y
 * expone las mutaciones que usa la tienda. Las políticas RLS limitan la escritura a editores.
 */
import type {
  Blueprint,
  ConstructionStage,
  Expense,
  InventoryMovement,
  Material,
  Project,
  ProjectMember,
  Quote,
  QuoteItem,
  Task,
  TaskNote,
  TaskStatus,
} from "@/types";
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

export interface ProjectBundle {
  projects: Project[];
  members: ProjectMember[];
  stages: ConstructionStage[];
  tasks: Task[];
  quotes: Quote[];
  materials: Material[];
  movements: InventoryMovement[];
  expenses: Expense[];
  plannedCurve: { date: string; amount: number }[];
  blueprints: Blueprint[];
  approvedBudget: number;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

const toProject = (r: Row): Project => ({
  id: r.id,
  code: r.code,
  name: r.name,
  city: r.city,
  country: r.country,
  type: r.type,
  builtAreaM2: num(r.built_area_m2),
  levels: r.levels,
  structuralSystem: r.structural_system,
  status: r.status,
  startDate: r.start_date,
  plannedEndDate: r.planned_end_date,
  hasDemoData: r.has_demo_data,
});

const toNote = (r: Row): TaskNote => ({ id: r.id, text: r.text, createdAt: r.created_at, authorId: r.author_id ?? "" });

const toTask = (r: Row, notes: TaskNote[]): Task => ({
  id: r.id,
  stageId: r.stage_id,
  title: r.title,
  description: r.description,
  status: r.status,
  assigneeId: r.assignee_id ?? "",
  dueDate: r.due_date,
  priority: r.priority,
  notes,
  elementIds: r.element_ids ?? [],
  category: r.category,
});

const toQuoteItem = (r: Row): QuoteItem => ({
  id: r.id,
  description: r.description,
  category: r.category,
  unit: r.unit,
  quantity: num(r.quantity),
  unitPrice: num(r.unit_price),
});

/** Con RLS, una escritura bloqueada no falla: afecta 0 filas. Se trata como falta de permiso. */
function affected(res: { data: Row[] | null; error: { message: string } | null }) {
  const rows = check<Row[]>(res);
  if (!rows || rows.length === 0) throw new Error("Tu cuenta no tiene permiso para modificar estos datos.");
  return rows;
}

/** PostgREST devuelve como máximo 1000 filas por consulta: paginar las tablas grandes. */
async function selectAll(table: string, build: (q: any) => any): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = check<Row[]>(await build(db().from(table).select("*")).range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function loadProjectBundle(projectId: string): Promise<ProjectBundle> {
  const c = db();
  const [projects, members, stages, materials, quotes, expenses, curve, blueprints] = await Promise.all([
    c.from("projects").select("*").order("code").then(check<Row[]>),
    c.from("members").select("*").order("id").then(check<Row[]>),
    c.from("stages").select("*").eq("project_id", projectId).order("sort_order").then(check<Row[]>),
    c.from("materials").select("*").eq("project_id", projectId).order("sort_order").then(check<Row[]>),
    c.from("quotes").select("*, quote_items(*)").eq("project_id", projectId).order("created_at").then(check<Row[]>),
    c.from("expenses").select("*").eq("project_id", projectId).order("date").then(check<Row[]>),
    c.from("planned_curve").select("*").eq("project_id", projectId).order("date").then(check<Row[]>),
    c.from("blueprints").select("*").eq("project_id", projectId).order("sort_order").then(check<Row[]>),
  ]);
  const stageIds = stages.map((s) => s.id);
  const materialIds = materials.map((m) => m.id);
  const [tasks, movements] = await Promise.all([
    stageIds.length ? selectAll("tasks", (q) => q.in("stage_id", stageIds).order("sort_order").order("id")) : Promise.resolve([]),
    materialIds.length ? c.from("inventory_movements").select("*").in("material_id", materialIds).order("date").then(check<Row[]>) : Promise.resolve([]),
  ]);
  const taskIds = new Set(tasks.map((t) => t.id));
  const notes = (await selectAll("task_notes", (q) => q.order("created_at"))).filter((n) => taskIds.has(n.task_id));
  const notesByTask = new Map<string, TaskNote[]>();
  for (const n of notes) notesByTask.set(n.task_id, [...(notesByTask.get(n.task_id) ?? []), toNote(n)]);

  const project = projects.find((p) => p.id === projectId);
  return {
    projects: projects.map(toProject),
    members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, initials: m.initials })),
    stages: stages.map((s) => ({ id: s.id, projectId: s.project_id, order: s.sort_order, name: s.name, icon: s.icon, weight: num(s.weight) })),
    tasks: tasks.map((t) => toTask(t, notesByTask.get(t.id) ?? [])),
    quotes: quotes.map((q) => ({
      id: q.id,
      code: q.code,
      projectId: q.project_id,
      clientName: q.client_name,
      title: q.title,
      description: q.description,
      status: q.status,
      createdAt: q.created_at,
      items: [...(q.quote_items ?? [])].sort((a: Row, b: Row) => a.sort_order - b.sort_order).map(toQuoteItem),
      adjustments: q.adjustments,
      notes: q.notes,
    })),
    materials: materials.map((m) => ({
      id: m.id,
      name: m.name,
      spec: m.spec,
      unit: m.unit,
      plannedQty: num(m.planned_qty),
      receivedQty: num(m.received_qty),
      consumedQty: num(m.consumed_qty),
      unitPrice: num(m.unit_price),
      minStock: num(m.min_stock),
      supplier: m.supplier,
    })),
    movements: movements.map((m) => ({ id: m.id, materialId: m.material_id, type: m.type, qty: num(m.qty), date: m.date, reference: m.reference })),
    expenses: expenses.map((e) => ({ id: e.id, date: e.date, concept: e.concept, category: e.category, amount: num(e.amount) })),
    plannedCurve: curve.map((c2) => ({ date: c2.date, amount: num(c2.amount) })),
    blueprints: blueprints.map((b) => ({ id: b.id, code: b.code, title: b.title, category: b.category, level: b.level, format: b.format, src: b.src, revision: b.revision, illustrative: b.illustrative })),
    approvedBudget: num(project?.approved_budget),
  };
}

// ── Mutaciones ──────────────────────────────────────────────────────────
export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  affected(await db().from("tasks").update({ status }).eq("id", taskId).select("id"));
}

export async function insertTaskNote(taskId: string, note: TaskNote) {
  affected(await db().from("task_notes").insert({ id: note.id, task_id: taskId, text: note.text, author_id: note.authorId || null, created_at: note.createdAt }).select("id"));
}

export async function insertTask(task: Task, sortOrder: number) {
  affected(
    await db()
      .from("tasks")
      .insert({
        id: task.id,
        stage_id: task.stageId,
        title: task.title,
        description: task.description,
        status: task.status,
        assignee_id: task.assigneeId || null,
        due_date: task.dueDate,
        priority: task.priority,
        category: task.category,
        element_ids: task.elementIds,
        sort_order: sortOrder,
      })
      .select("id"),
  );
}

export async function upsertStages(stages: ConstructionStage[]) {
  affected(
    await db()
      .from("stages")
      .upsert(stages.map((s) => ({ id: s.id, project_id: s.projectId, sort_order: s.order, name: s.name, icon: s.icon, weight: s.weight })))
      .select("id"),
  );
}

export async function saveQuoteRemote(q: Quote) {
  affected(
    await db()
      .from("quotes")
      .upsert({ id: q.id, code: q.code, project_id: q.projectId, client_name: q.clientName, title: q.title, description: q.description, status: q.status, created_at: q.createdAt, adjustments: q.adjustments, notes: q.notes })
      .select("id"),
  );
  check(await db().from("quote_items").delete().eq("quote_id", q.id).select("id"));
  if (q.items.length)
    check(
      await db()
        .from("quote_items")
        .insert(q.items.map((it, i) => ({ id: it.id, quote_id: q.id, sort_order: i, description: it.description, category: it.category, unit: it.unit, quantity: it.quantity, unit_price: it.unitPrice })))
        .select("id"),
    );
}
