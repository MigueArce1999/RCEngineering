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

export const toBlueprint = (b: Row): Blueprint => ({
  id: b.id,
  code: b.code,
  title: b.title,
  category: b.category,
  level: b.level,
  format: b.format,
  src: b.src,
  revision: b.revision,
  illustrative: b.illustrative,
  filePath: b.file_path,
  fileName: b.file_name,
  fileSize: Number(b.file_size ?? 0),
  mime: b.mime,
  notes: b.notes,
  uploadedAt: b.uploaded_at,
  sortOrder: b.sort_order,
  thumbPath: b.thumb_path,
});

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
  clientName: r.client_name ?? "",
  description: r.description ?? "",
  currency: r.currency ?? "COP",
  setupSkipped: r.setup_skipped ?? [],
  modelPath: r.model_path ?? null,
  modelSettings: r.model_settings ?? {},
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

export const emptyBundle = (projects: Project[] = []): ProjectBundle => ({
  projects,
  members: [],
  stages: [],
  tasks: [],
  quotes: [],
  materials: [],
  movements: [],
  expenses: [],
  plannedCurve: [],
  blueprints: [],
  approvedBudget: 0,
});

export async function listProjects(): Promise<Project[]> {
  return (await db().from("projects").select("*").order("created_at").then(check<Row[]>)).map(toProject);
}

export async function loadProjectBundle(projectId: string): Promise<ProjectBundle> {
  const c = db();
  const [projects, members, stages, materials, quotes, expenses, curve, blueprints] = await Promise.all([
    c.from("projects").select("*").order("created_at").then(check<Row[]>),
    c.from("members").select("*").eq("project_id", projectId).order("name").then(check<Row[]>),
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
    members: members.map((m) => ({ id: m.id, projectId: m.project_id, name: m.name, role: m.role, initials: m.initials })),
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
    blueprints: blueprints.map(toBlueprint),
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

// ── Asistente de configuración del proyecto ─────────────────────────────
export interface ProjectInput {
  code: string;
  name: string;
  clientName: string;
  description: string;
  type: string;
  city: string;
  country: string;
  builtAreaM2: number;
  levels: number;
  structuralSystem: string;
  status: Project["status"];
  startDate: string;
  plannedEndDate: string;
}

const projectRow = (id: string, p: ProjectInput) => ({
  id,
  code: p.code,
  name: p.name,
  client_name: p.clientName,
  description: p.description,
  type: p.type,
  city: p.city,
  country: p.country,
  built_area_m2: p.builtAreaM2,
  levels: p.levels,
  structural_system: p.structuralSystem,
  status: p.status,
  start_date: p.startDate,
  planned_end_date: p.plannedEndDate,
});

export async function createProject(id: string, p: ProjectInput) {
  affected(await db().from("projects").insert(projectRow(id, p)).select("id"));
}

export async function updateProject(id: string, p: ProjectInput) {
  affected(await db().from("projects").update(projectRow(id, p)).eq("id", id).select("id"));
}

export async function setSkippedSteps(id: string, skipped: string[]) {
  affected(await db().from("projects").update({ setup_skipped: skipped }).eq("id", id).select("id"));
}

export async function insertMember(m: ProjectMember & { projectId: string }) {
  affected(await db().from("members").insert({ id: m.id, project_id: m.projectId, name: m.name, role: m.role, initials: m.initials }).select("id"));
}

export async function deleteMember(id: string) {
  affected(await db().from("members").delete().eq("id", id).select("id"));
}

export async function deleteStage(id: string) {
  affected(await db().from("stages").delete().eq("id", id).select("id"));
}

export async function deleteTask(id: string) {
  affected(await db().from("tasks").delete().eq("id", id).select("id"));
}

/** Presupuesto aprobado + curva de inversión planeada (lineal entre inicio y fin del proyecto). */
export async function setBudget(projectId: string, amount: number, curve: { date: string; amount: number }[]) {
  affected(await db().from("projects").update({ approved_budget: amount }).eq("id", projectId).select("id"));
  check(await db().from("planned_curve").delete().eq("project_id", projectId).select("project_id"));
  if (curve.length) affected(await db().from("planned_curve").insert(curve.map((c) => ({ project_id: projectId, date: c.date, amount: c.amount }))).select("project_id"));
}

export async function insertExpense(projectId: string, e: Expense) {
  affected(await db().from("expenses").insert({ id: e.id, project_id: projectId, date: e.date, concept: e.concept, category: e.category, amount: e.amount }).select("id"));
}

export async function deleteExpense(id: string) {
  affected(await db().from("expenses").delete().eq("id", id).select("id"));
}

export async function insertMaterial(projectId: string, m: Material, sortOrder: number) {
  affected(
    await db()
      .from("materials")
      .insert({ id: m.id, project_id: projectId, name: m.name, spec: m.spec, unit: m.unit, planned_qty: m.plannedQty, unit_price: m.unitPrice, min_stock: m.minStock, supplier: m.supplier, sort_order: sortOrder })
      .select("id"),
  );
}

export async function deleteMaterial(id: string) {
  affected(await db().from("materials").delete().eq("id", id).select("id"));
}

export async function insertMovement(m: InventoryMovement) {
  affected(await db().from("inventory_movements").insert({ id: m.id, material_id: m.materialId, type: m.type, qty: m.qty, date: m.date, reference: m.reference }).select("id"));
}

// ── Modelo 3D del proyecto (Storage privado) ────────────────────────────
const MODEL_BUCKET = "project-models";

export async function uploadProjectModel(projectId: string, file: File) {
  const path = `${projectId}/modelo-${Date.now()}.html`;
  const up = await db().storage.from(MODEL_BUCKET).upload(path, file, { contentType: "text/html", upsert: false });
  if (up.error) throw new Error(up.error.message);
  affected(await db().from("projects").update({ model_path: path, model_settings: {} }).eq("id", projectId).select("id"));
  return path;
}

export async function removeProjectModel(projectId: string) {
  affected(await db().from("projects").update({ model_path: null }).eq("id", projectId).select("id"));
}

export async function downloadProjectModel(path: string) {
  const { data, error } = await db().storage.from(MODEL_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el modelo");
  return data.text();
}

export async function saveModelSettings(projectId: string, settings: Record<string, string>) {
  affected(await db().from("projects").update({ model_settings: settings }).eq("id", projectId).select("id"));
}
