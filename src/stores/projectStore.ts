"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type {
  Blueprint,
  ConstructionStage,
  Expense,
  InventoryMovement,
  Material,
  Project,
  ProjectMember,
  Quote,
  Task,
  TaskNote,
  TaskStatus,
} from "@/types";
import * as demo from "@/data/demo";
import { buildDemoTasks } from "@/data/tasks";
import { uid } from "@/lib/format";
import { isRemote } from "@/lib/supabase";
import * as api from "@/lib/api";
import { can, useAuth, type Permission } from "./authStore";
import { useUI } from "./uiStore";

/**
 * Estado del proyecto activo.
 * - Con Supabase configurado: se carga de la base y cada cambio se guarda allí
 *   (actualización optimista; si falla se revierte recargando y se avisa).
 * - Sin Supabase: datos de demostración persistidos en localStorage.
 */
interface Catalog {
  projects: Project[];
  members: ProjectMember[];
  materials: Material[];
  movements: InventoryMovement[];
  expenses: Expense[];
  plannedCurve: { date: string; amount: number }[];
  blueprints: Blueprint[];
  approvedBudget: number;
}

interface ProjectState extends Catalog {
  projectId: string;
  stages: ConstructionStage[];
  tasks: Task[];
  quotes: Quote[];
  source: "local" | "remote";
  loadState: "idle" | "loading" | "ready" | "error";
  loadError: string | null;

  load: () => Promise<void>;

  setTaskStatus: (taskId: string, status: TaskStatus) => boolean;
  toggleTaskDone: (taskId: string) => boolean;
  addTaskNote: (taskId: string, text: string) => boolean;
  addTask: (stageId: string, input: Pick<Task, "title" | "description" | "assigneeId" | "dueDate" | "priority">) => string | null;

  renameStage: (stageId: string, name: string) => boolean;
  moveStage: (stageId: string, direction: -1 | 1) => boolean;
  addStage: (name: string) => string | null;

  saveQuote: (quote: Quote) => boolean;
  resetDemo: () => void;

  // ── Proyectos reales y asistente de configuración ──
  selectProject: (id: string) => Promise<void>;
  createProject: (input: api.ProjectInput) => Promise<string | null>;
  updateProject: (input: api.ProjectInput) => Promise<boolean>;
  setStepSkipped: (step: string, skipped: boolean) => Promise<boolean>;
  addMember: (input: { name: string; role: string }) => Promise<boolean>;
  removeMember: (id: string) => Promise<boolean>;
  saveStages: (stages: ConstructionStage[]) => Promise<boolean>;
  removeStage: (id: string) => Promise<boolean>;
  removeTask: (id: string) => Promise<boolean>;
  setBudget: (amount: number) => Promise<boolean>;
  addExpense: (input: Omit<Expense, "id">) => Promise<boolean>;
  removeExpense: (id: string) => Promise<boolean>;
  addMaterial: (input: Omit<Material, "id" | "receivedQty" | "consumedQty">, initialReceived: number) => Promise<boolean>;
  removeMaterial: (id: string) => Promise<boolean>;
  addMovement: (input: Omit<InventoryMovement, "id">) => Promise<boolean>;
  uploadModel: (file: File) => Promise<boolean>;
  removeModel: () => Promise<boolean>;
  saveModelSettings: (settings: Record<string, string>) => Promise<boolean>;
}

const demoCatalog = (): Catalog => ({
  projects: demo.projects,
  members: demo.members,
  materials: demo.materials,
  movements: demo.movements,
  expenses: demo.expenses,
  plannedCurve: demo.plannedCurve,
  blueprints: demo.blueprints,
  approvedBudget: demo.APPROVED_BUDGET,
});

const initial = () =>
  isRemote
    ? // Con Supabase se arranca vacío: los datos reales llegan en load()
      { projectId: "", ...api.emptyBundle() }
    : {
        projectId: "prj-rc-001",
        stages: demo.stages,
        tasks: buildDemoTasks(),
        quotes: demo.quotes,
        ...demoCatalog(),
      };

const ACTIVE_KEY = "rc-eos-active-project";
const readActive = () => {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
};
const writeActive = (id: string) => {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* almacenamiento no disponible */
  }
};

/** Iniciales a partir del nombre ("Camila Restrepo" → "CR"). */
const initialsOf = (name: string) =>
  name
    .replace(/^(ing|arq|téc|tec|m\.?\s?o)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

// En modo remoto no se escribe nada en localStorage: la fuente de verdad es Supabase.
const noopStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const PERM_LABEL: Record<Permission, string> = {
  "project.view": "ver el proyecto",
  "projects.manage": "gestionar proyectos",
  "finance.manage": "gestionar finanzas",
  "inventory.manage": "gestionar materiales e inventario",
  "tasks.edit": "gestionar actividades",
  "stages.manage": "gestionar etapas",
  "quotes.manage": "gestionar cotizaciones",
  "users.manage": "gestionar usuarios",
};

/** Bloquea la acción si el rol del usuario no tiene el permiso y lo explica. */
function guard(perm: Permission) {
  if (can(perm)) return true;
  const role = useAuth.getState().profile?.roleName ?? "actual";
  useUI.getState().toast({
    title: `Tu rol (${role}) no permite ${PERM_LABEL[perm]}`,
    description: "Pide a un administrador que te asigne un rol con ese permiso.",
    tone: "info",
  });
  return false;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => {
      /** Aplica el cambio local y lo envía a Supabase; si falla, recarga desde la base. */
      const remote = (label: string, op: () => Promise<unknown>) => {
        if (!isRemote) return;
        op().catch((e: Error) => {
          useUI.getState().toast({ title: `No se pudo guardar: ${label}`, description: e.message, tone: "warning" });
          void get().load();
        });
      };

      /** Operación con confirmación (formularios del asistente): espera a Supabase y avisa si falla. */
      const attempt = async (label: string, op: () => Promise<unknown>) => {
        if (!isRemote) {
          useUI.getState().toast({ title: "Disponible solo con base de datos", description: "En modo local los datos de demostración no se editan desde el asistente.", tone: "info" });
          return false;
        }
        try {
          await op();
          return true;
        } catch (e) {
          useUI.getState().toast({ title: `No se pudo guardar: ${label}`, description: (e as Error).message, tone: "warning" });
          return false;
        }
      };

      return {
        ...initial(),
        source: isRemote ? "remote" : "local",
        loadState: isRemote ? "idle" : "ready",
        loadError: null,

        load: async () => {
          if (!isRemote) return;
          if (get().loadState === "idle") set({ loadState: "loading" });
          try {
            const projects = await api.listProjects();
            if (!projects.length) {
              set({ projectId: "", ...api.emptyBundle(), loadState: "ready", loadError: null });
              return;
            }
            const wanted = get().projectId || readActive();
            const id = projects.some((p) => p.id === wanted) ? wanted! : projects[projects.length - 1].id;
            const b = await api.loadProjectBundle(id);
            set({ projectId: id, ...b, loadState: "ready", loadError: null });
          } catch (e) {
            set({ loadState: "error", loadError: (e as Error).message });
          }
        },

        setTaskStatus: (taskId, status) => {
          if (!guard("tasks.edit")) return false;
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) }));
          remote("estado de la actividad", () => api.updateTaskStatus(taskId, status));
          return true;
        },

        toggleTaskDone: (taskId) => {
          const t = get().tasks.find((x) => x.id === taskId);
          if (!t) return false;
          return get().setTaskStatus(taskId, t.status === "done" ? "pending" : "done");
        },

        addTaskNote: (taskId, text) => {
          if (!guard("tasks.edit")) return false;
          const note: TaskNote = { id: uid("note"), text, createdAt: new Date().toISOString(), authorId: "" };
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, notes: [...t.notes, note] } : t)) }));
          remote("observación", () => api.insertTaskNote(taskId, note));
          return true;
        },

        addTask: (stageId, input) => {
          if (!guard("tasks.edit")) return null;
          const task: Task = { id: uid("tsk"), stageId, status: "pending", notes: [], elementIds: [], category: "Personalizada", ...input };
          set((s) => ({ tasks: [...s.tasks, task] }));
          const order = get().tasks.filter((t) => t.stageId === stageId).length + 10_000;
          remote("actividad", () => api.insertTask(task, order));
          return task.id;
        },

        renameStage: (stageId, name) => {
          if (!guard("stages.manage")) return false;
          set((s) => ({ stages: s.stages.map((st) => (st.id === stageId ? { ...st, name } : st)) }));
          remote("nombre de la etapa", () => api.upsertStages(get().stages.filter((s) => s.id === stageId)));
          return true;
        },

        moveStage: (stageId, direction) => {
          if (!guard("stages.manage")) return false;
          const sorted = [...get().stages].sort((a, b) => a.order - b.order);
          const i = sorted.findIndex((s) => s.id === stageId);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= sorted.length) return false;
          [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
          const next = sorted.map((s, k) => ({ ...s, order: k + 1 }));
          set({ stages: next });
          remote("orden de etapas", () => api.upsertStages(next));
          return true;
        },

        addStage: (name) => {
          if (!guard("stages.manage")) return null;
          const stage: ConstructionStage = { id: uid("stg"), projectId: get().projectId, order: get().stages.length + 1, name, icon: "generic", weight: 0.1 };
          set((s) => ({ stages: [...s.stages, stage] }));
          remote("etapa", () => api.upsertStages([stage]));
          return stage.id;
        },

        saveQuote: (quote) => {
          if (!guard("quotes.manage")) return false;
          set((s) => {
            const exists = s.quotes.some((q) => q.id === quote.id);
            return { quotes: exists ? s.quotes.map((q) => (q.id === quote.id ? quote : q)) : [...s.quotes, quote] };
          });
          remote("cotización", () => api.saveQuoteRemote(quote));
          return true;
        },

        selectProject: async (id) => {
          writeActive(id);
          set({ projectId: id });
          await get().load();
        },

        createProject: async (input) => {
          if (!guard("projects.manage")) return null;
          const id = uid("prj");
          if (!(await attempt("proyecto", () => api.createProject(id, input)))) return null;
          // Etapas base sugeridas: el usuario las ajusta en el paso "Etapas"
          await get().selectProject(id);
          return id;
        },

        updateProject: async (input) => {
          if (!guard("projects.manage")) return false;
          const ok = await attempt("datos del proyecto", () => api.updateProject(get().projectId, input));
          if (ok) await get().load();
          return ok;
        },

        setStepSkipped: async (step, skipped) => {
          if (!guard("projects.manage")) return false;
          const p = get().projects.find((x) => x.id === get().projectId);
          const current = new Set(p?.setupSkipped ?? []);
          if (skipped) current.add(step);
          else current.delete(step);
          const list = [...current];
          const ok = await attempt("estado del paso", () => api.setSkippedSteps(get().projectId, list));
          if (ok) set((s) => ({ projects: s.projects.map((x) => (x.id === s.projectId ? { ...x, setupSkipped: list } : x)) }));
          return ok;
        },

        addMember: async ({ name, role }) => {
          if (!guard("projects.manage")) return false;
          const m = { id: uid("mbr"), projectId: get().projectId, name: name.trim(), role: role.trim(), initials: initialsOf(name) };
          const ok = await attempt("integrante", () => api.insertMember(m));
          if (ok) set((s) => ({ members: [...s.members, m].sort((a, b) => a.name.localeCompare(b.name)) }));
          return ok;
        },

        removeMember: async (id) => {
          if (!guard("projects.manage")) return false;
          const ok = await attempt("integrante", () => api.deleteMember(id));
          if (ok) set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
          return ok;
        },

        saveStages: async (stages) => {
          if (!guard("stages.manage")) return false;
          const next = stages.map((s, i) => ({ ...s, projectId: get().projectId, order: i + 1 }));
          const ok = await attempt("etapas", () => api.upsertStages(next));
          if (ok) set({ stages: next });
          return ok;
        },

        removeStage: async (id) => {
          if (!guard("stages.manage")) return false;
          const ok = await attempt("etapa", () => api.deleteStage(id));
          if (ok) set((s) => ({ stages: s.stages.filter((x) => x.id !== id), tasks: s.tasks.filter((t) => t.stageId !== id) }));
          return ok;
        },

        removeTask: async (id) => {
          if (!guard("stages.manage")) return false;
          const ok = await attempt("actividad", () => api.deleteTask(id));
          if (ok) set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
          return ok;
        },

        setBudget: async (amount) => {
          if (!guard("finance.manage")) return false;
          const p = get().projects.find((x) => x.id === get().projectId);
          // Curva planeada inicial: inversión lineal entre la fecha de inicio y la de entrega
          const curve = p ? [{ date: p.startDate, amount: 0 }, { date: p.plannedEndDate, amount }] : [];
          const ok = await attempt("presupuesto", () => api.setBudget(get().projectId, amount, curve));
          if (ok) set({ approvedBudget: amount, plannedCurve: curve });
          return ok;
        },

        addExpense: async (input) => {
          if (!guard("finance.manage")) return false;
          const e = { ...input, id: uid("exp") };
          const ok = await attempt("gasto", () => api.insertExpense(get().projectId, e));
          if (ok) set((s) => ({ expenses: [...s.expenses, e].sort((a, b) => a.date.localeCompare(b.date)) }));
          return ok;
        },

        removeExpense: async (id) => {
          if (!guard("finance.manage")) return false;
          const ok = await attempt("gasto", () => api.deleteExpense(id));
          if (ok) set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
          return ok;
        },

        addMaterial: async (input, initialReceived) => {
          if (!guard("inventory.manage")) return false;
          const m: Material = { ...input, id: uid("mat"), receivedQty: 0, consumedQty: 0 };
          const ok = await attempt("material", () => api.insertMaterial(get().projectId, m, get().materials.length));
          if (!ok) return false;
          if (initialReceived > 0)
            await attempt("entrada inicial de inventario", () =>
              api.insertMovement({ id: uid("mov"), materialId: m.id, type: "in", qty: initialReceived, date: new Date().toISOString().slice(0, 10), reference: "Inventario inicial" }),
            );
          await get().load();
          return true;
        },

        removeMaterial: async (id) => {
          if (!guard("inventory.manage")) return false;
          const ok = await attempt("material", () => api.deleteMaterial(id));
          if (ok) set((s) => ({ materials: s.materials.filter((m) => m.id !== id), movements: s.movements.filter((m) => m.materialId !== id) }));
          return ok;
        },

        addMovement: async (input) => {
          if (!guard("inventory.manage")) return false;
          const ok = await attempt("movimiento de inventario", () => api.insertMovement({ ...input, id: uid("mov") }));
          if (ok) await get().load();
          return ok;
        },

        uploadModel: async (file) => {
          if (!guard("projects.manage")) return false;
          const ok = await attempt("modelo 3D", () => api.uploadProjectModel(get().projectId, file));
          if (ok) await get().load();
          return ok;
        },

        removeModel: async () => {
          if (!guard("projects.manage")) return false;
          const ok = await attempt("modelo 3D", () => api.removeProjectModel(get().projectId));
          if (ok) set((s) => ({ projects: s.projects.map((p) => (p.id === s.projectId ? { ...p, modelPath: null } : p)) }));
          return ok;
        },

        // Silencioso: los ajustes del modelo (p. ej. alturas) se guardan sin avisos si el rol lo permite
        saveModelSettings: async (settings) => {
          set((s) => ({ projects: s.projects.map((p) => (p.id === s.projectId ? { ...p, modelSettings: settings } : p)) }));
          if (!isRemote || !can("projects.manage")) return false;
          try {
            await api.saveModelSettings(get().projectId, settings);
            return true;
          } catch {
            return false;
          }
        },

        resetDemo: () => {
          if (isRemote) return;
          set(initial());
        },
      };
    },
    {
      name: "rc-eos-project",
      version: 2,
      storage: createJSONStorage(() => (isRemote ? noopStorage : localStorage)),
      // Se rehidrata en el cliente tras el primer render (ver EngineeringDashboard) para evitar desajustes SSR.
      skipHydration: true,
      partialize: (s) => ({ projectId: s.projectId, stages: s.stages, tasks: s.tasks, quotes: s.quotes }),
    },
  ),
);

export const sortedStages = (stages: ConstructionStage[]) => [...stages].sort((a, b) => a.order - b.order);
