/**
 * Genera supabase/seed.sql a partir de los datos de demostración (src/data).
 * Uso: npx tsx scripts/build-seed.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { APPROVED_BUDGET, blueprints, expenses, materials, members, movements, plannedCurve, projects, quotes, stages } from "../src/data/demo";
import { buildDemoTasks } from "../src/data/tasks";

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `array[${v.map(lit).join(",")}]::text[]`;
  if (typeof v === "object") return `${lit(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const insert = (table: string, rows: Record<string, unknown>[]) =>
  rows.length
    ? `insert into public.${table} (${Object.keys(rows[0]).join(", ")}) values\n${rows.map((r) => `  (${Object.values(r).map(lit).join(", ")})`).join(",\n")};\n`
    : "";

const PID = "prj-rc-001";
let sql = "-- Datos de demostración (FICTICIOS) · generado por scripts/build-seed.ts\nbegin;\n";
sql += insert("projects", projects.map((p) => ({ id: p.id, code: p.code, name: p.name, city: p.city, country: p.country, type: p.type, built_area_m2: p.builtAreaM2, levels: p.levels, structural_system: p.structuralSystem, status: p.status, start_date: p.startDate, planned_end_date: p.plannedEndDate, has_demo_data: p.hasDemoData, approved_budget: p.id === PID ? APPROVED_BUDGET : 0 })));
sql += insert("members", members.map((m) => ({ id: m.id, name: m.name, role: m.role, initials: m.initials })));
sql += insert("stages", stages.map((s) => ({ id: s.id, project_id: s.projectId, sort_order: s.order, name: s.name, icon: s.icon, weight: s.weight })));
const tasks = buildDemoTasks();
for (let i = 0; i < tasks.length; i += 200)
  sql += insert("tasks", tasks.slice(i, i + 200).map((t, k) => ({ id: t.id, stage_id: t.stageId, title: t.title, description: t.description, status: t.status, assignee_id: t.assigneeId, due_date: t.dueDate, priority: t.priority, category: t.category, element_ids: t.elementIds, sort_order: i + k })));
sql += insert("materials", materials.map((m, i) => ({ id: m.id, project_id: PID, name: m.name, spec: m.spec, unit: m.unit, planned_qty: m.plannedQty, received_qty: m.receivedQty, consumed_qty: m.consumedQty, unit_price: m.unitPrice, min_stock: m.minStock, supplier: m.supplier, sort_order: i })));
sql += insert("inventory_movements", movements.map((m) => ({ id: m.id, material_id: m.materialId, type: m.type, qty: m.qty, date: m.date, reference: m.reference })));
sql += insert("quotes", quotes.map((q) => ({ id: q.id, code: q.code, project_id: q.projectId, client_name: q.clientName, title: q.title, description: q.description, status: q.status, created_at: q.createdAt, adjustments: q.adjustments, notes: q.notes })));
sql += insert("quote_items", quotes.flatMap((q) => q.items.map((it, i) => ({ id: it.id, quote_id: q.id, sort_order: i, description: it.description, category: it.category, unit: it.unit, quantity: it.quantity, unit_price: it.unitPrice }))));
sql += insert("expenses", expenses.map((e) => ({ id: e.id, project_id: PID, date: e.date, concept: e.concept, category: e.category, amount: e.amount })));
sql += insert("planned_curve", plannedCurve.map((c) => ({ project_id: PID, date: c.date, amount: c.amount })));
sql += insert("blueprints", blueprints.map((b, i) => ({ id: b.id, project_id: PID, code: b.code, title: b.title, category: b.category, level: b.level, format: b.format, src: b.src, revision: b.revision, illustrative: b.illustrative, sort_order: i })));
sql += "commit;\n";

writeFileSync(join(__dirname, "..", "supabase", "seed.sql"), sql);
console.log(`seed.sql: ${tasks.length} actividades, ${(sql.length / 1024).toFixed(0)} KB`);
