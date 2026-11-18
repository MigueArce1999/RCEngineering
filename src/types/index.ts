/**
 * Modelo de dominio de RC Engineering OS.
 * Estos tipos son el contrato entre la UI y la futura API (Supabase/PostgreSQL).
 * Todas las cantidades monetarias se expresan en COP (enteros, sin decimales).
 */

export type ID = string;
export type ISODate = string; // YYYY-MM-DD

export type ProjectStatus = "active" | "paused" | "closed";

export interface Project {
  id: ID;
  code: string;
  name: string;
  city: string;
  country: string;
  type: string;
  builtAreaM2: number;
  levels: number;
  structuralSystem: string;
  status: ProjectStatus;
  startDate: ISODate;
  plannedEndDate: ISODate;
  /** true si el proyecto tiene datos cargados (en modo demo, solo RC-001) */
  hasDemoData: boolean;
  clientName?: string;
  description?: string;
  currency?: string;
  /** Pasos opcionales del asistente marcados como "no aplica" */
  setupSkipped?: string[];
}

export type StageIcon = "survey" | "design" | "build" | "finish" | "generic";

export interface ConstructionStage {
  id: ID;
  projectId: ID;
  order: number;
  name: string;
  icon: StageIcon;
  /** Peso de la etapa en el avance físico general (0–1). Las etapas de un proyecto suman 1. */
  weight: number;
}

/** Estado derivado de una etapa a partir de sus actividades. */
export type StageStatus = "pending" | "in_progress" | "completed";

export type TaskStatus = "pending" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high" | "critical";

export interface TaskNote {
  id: ID;
  text: string;
  createdAt: string; // ISO datetime
  authorId: ID;
}

export interface Task {
  id: ID;
  stageId: ID;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: ID;
  dueDate: ISODate;
  priority: Priority;
  notes: TaskNote[];
  /** Elementos del modelo 3D vinculados a la actividad */
  elementIds: ID[];
  category: string;
}

export interface ProjectMember {
  id: ID;
  projectId?: ID;
  name: string;
  role: string;
  initials: string;
}

export type MaterialUnit = "kg" | "m³" | "m²" | "und" | "bulto 50 kg" | "ml";

export interface Material {
  id: ID;
  name: string;
  spec: string;
  unit: MaterialUnit;
  /** Cantidad prevista en el presupuesto */
  plannedQty: number;
  /** Cantidad recibida en obra a la fecha */
  receivedQty: number;
  /** Cantidad consumida (instalada) a la fecha */
  consumedQty: number;
  unitPrice: number;
  /** Stock mínimo antes de alerta de abastecimiento */
  minStock: number;
  supplier: string;
}

export type MovementType = "in" | "out";

export interface InventoryMovement {
  id: ID;
  materialId: ID;
  type: MovementType;
  qty: number;
  date: ISODate;
  reference: string;
}

/** Vista derivada (no persistida) de un material en bodega */
export interface InventoryItem {
  materialId: ID;
  name: string;
  unit: MaterialUnit;
  stock: number;
  minStock: number;
  low: boolean;
}

export type QuoteStatus = "draft" | "pending" | "approved" | "rejected";
export type CostCategory = "materials" | "labor" | "equipment" | "other";

export interface QuoteItem {
  id: ID;
  description: string;
  category: CostCategory;
  unit: MaterialUnit | "gl" | "día" | "mes";
  quantity: number;
  unitPrice: number;
}

export interface QuoteAdjustments {
  discountPct: number;
  aiu: { enabled: boolean; adminPct: number; contingencyPct: number; profitPct: number };
  vat: { enabled: boolean; ratePct: number };
}

export interface Quote {
  id: ID;
  code: string;
  projectId: ID;
  clientName: string;
  title: string;
  description: string;
  status: QuoteStatus;
  createdAt: ISODate;
  items: QuoteItem[];
  adjustments: QuoteAdjustments;
  notes: string;
}

export interface Expense {
  id: ID;
  date: ISODate;
  concept: string;
  category: CostCategory;
  amount: number;
}

export interface FinancialSummary {
  approvedBudget: number;
  executed: number;
  available: number;
  executionPct: number;
  plannedToDate: number;
  /** (ejecutado − planeado a la fecha) / planeado a la fecha */
  deviationPct: number;
}

export type BlueprintCategory =
  | "architectural"
  | "structural"
  | "electrical"
  | "plumbing"
  | "roof"
  | "details";

export interface Blueprint {
  id: ID;
  code: string;
  title: string;
  category: BlueprintCategory;
  level: "N1" | "N2" | "Cubierta" | "General";
  format: "svg" | "png" | "pdf";
  src: string;
  revision: string;
  /** Los planos de demostración son ilustrativos y no aptos para construcción */
  illustrative: boolean;
}

export type ElementType = "wall" | "column" | "beam" | "slab" | "roof" | "door" | "window" | "footing" | "railing" | "stair";

export interface ModelElement {
  id: ID;
  type: ElementType;
  name: string;
  level: 0 | 1 | 2 | 3; // 0 cimentación · 1 nivel 1 · 2 nivel 2 · 3 cubierta
  material: string;
  /** Dimensiones reales en metros [ancho x, alto y, profundidad z] */
  size: [number, number, number];
  position: [number, number, number];
  stageId: ID;
  blueprintIds: ID[];
  estimatedCost?: number;
  /** Clave de material visual del render */
  look: string;
  structural: boolean;
}

export interface Activity {
  id: ID;
  taskId: ID;
  label: string;
  date: ISODate;
}
