/**
 * Asistente "Completa tu proyecto": pasos, criterios de completitud y progreso.
 * El progreso se calcula siempre a partir de los datos reales guardados (no de casillas manuales),
 * salvo los pasos opcionales que el usuario marca como "No aplica".
 */
import type { ConstructionStage, Expense, Material, Project, ProjectMember, Quote, Task } from "@/types";

export type SetupStepId = "general" | "team" | "stages" | "tasks" | "budget" | "inventory" | "quotes";

export interface SetupStep {
  id: SetupStepId;
  title: string;
  short: string;
  why: string;
  optional: boolean;
}

export const SETUP_STEPS: SetupStep[] = [
  { id: "general", title: "Información general", short: "Datos", why: "Identifica la obra: nombre, cliente, ubicación, área y fechas. Alimenta la ficha del proyecto y la curva de inversión.", optional: false },
  { id: "team", title: "Equipo del proyecto", short: "Equipo", why: "Las personas responsables de cada actividad. Sin equipo no hay a quién asignar trabajos.", optional: false },
  { id: "stages", title: "Etapas constructivas", short: "Etapas", why: "Dividen la obra en fases con un peso en el avance físico. Sus pesos deben sumar 100 %.", optional: false },
  { id: "tasks", title: "Actividades", short: "Actividades", why: "El trabajo concreto de cada etapa. El avance de la obra se calcula con las actividades completadas.", optional: false },
  { id: "budget", title: "Presupuesto y finanzas", short: "Finanzas", why: "Presupuesto aprobado y gastos ejecutados. Permite medir la ejecución financiera y la desviación frente al plan.", optional: false },
  { id: "inventory", title: "Materiales e inventario", short: "Materiales", why: "Materiales previstos, su precio y el stock en bodega. Genera alertas de abastecimiento.", optional: true },
  { id: "quotes", title: "Cotizaciones", short: "Cotizaciones", why: "Propuestas económicas al cliente o de proveedores asociadas al proyecto.", optional: true },
];

export interface SetupData {
  project?: Project;
  members: ProjectMember[];
  stages: ConstructionStage[];
  tasks: Task[];
  approvedBudget: number;
  expenses: Expense[];
  materials: Material[];
  quotes: Quote[];
}

export type StepStatus = "done" | "skipped" | "pending";

export const stagesWeightTotal = (stages: ConstructionStage[]) => Math.round(stages.reduce((s, x) => s + x.weight, 0) * 1000) / 10;

export function stepStatus(step: SetupStepId, d: SetupData): StepStatus {
  const p = d.project;
  if (!p) return "pending";
  const skipped = p.setupSkipped?.includes(step);
  switch (step) {
    case "general":
      return p.name && p.city && p.type && p.startDate && p.plannedEndDate ? "done" : "pending";
    case "team":
      return d.members.length > 0 ? "done" : "pending";
    case "stages":
      return d.stages.length > 0 && Math.abs(stagesWeightTotal(d.stages) - 100) < 0.5 ? "done" : "pending";
    case "tasks":
      return d.stages.length > 0 && d.stages.every((s) => d.tasks.some((t) => t.stageId === s.id)) ? "done" : "pending";
    case "budget":
      return d.approvedBudget > 0 ? "done" : "pending";
    case "inventory":
      return d.materials.length > 0 ? "done" : skipped ? "skipped" : "pending";
    case "quotes":
      return d.quotes.length > 0 ? "done" : skipped ? "skipped" : "pending";
  }
}

export function setupProgress(d: SetupData) {
  const statuses = SETUP_STEPS.map((s) => ({ step: s, status: stepStatus(s.id, d) }));
  const resolved = statuses.filter((s) => s.status !== "pending").length;
  const next = statuses.find((s) => s.status === "pending")?.step ?? null;
  return { statuses, resolved, total: SETUP_STEPS.length, fraction: resolved / SETUP_STEPS.length, next, complete: !next };
}

/** Plantilla sugerida de etapas para obra de edificación (pesos editables). */
export const STAGE_TEMPLATE: { name: string; icon: ConstructionStage["icon"]; weight: number }[] = [
  { name: "Estudios y levantamiento", icon: "survey", weight: 0.08 },
  { name: "Diseño y planificación", icon: "design", weight: 0.12 },
  { name: "Ejecución de obra", icon: "build", weight: 0.62 },
  { name: "Acabados y entrega", icon: "finish", weight: 0.18 },
];

/** Actividades sugeridas por tipo de etapa (el usuario elige cuáles agregar). */
export const TASK_SUGGESTIONS: Record<ConstructionStage["icon"], string[]> = {
  survey: ["Visita técnica al predio", "Levantamiento topográfico", "Estudio de suelos", "Registro fotográfico", "Consulta de norma urbanística", "Informe de hallazgos"],
  design: ["Diseño arquitectónico", "Diseño estructural", "Diseños eléctricos e hidrosanitarios", "Presupuesto y APU", "Programación de obra", "Licencia de construcción"],
  build: ["Localización y replanteo", "Excavación y cimentación", "Estructura en concreto", "Mampostería", "Instalaciones hidrosanitarias", "Instalaciones eléctricas", "Cubierta"],
  finish: ["Pañetes y estucos", "Pisos y enchapes", "Carpintería y ventanería", "Pintura", "Aparatos sanitarios", "Limpieza y entrega"],
  generic: ["Planificación de la etapa", "Ejecución", "Revisión y cierre"],
};
