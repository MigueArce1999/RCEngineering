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

const initial = () => ({
  projectId: "prj-rc-001",
  stages: demo.stages,
  tasks: buildDemoTasks(),
  quotes: demo.quotes,
  ...demoCatalog(),
});

// En modo remoto no se escribe nada en localStorage: la fuente de verdad es Supabase.
const noopStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const PERM_LABEL: Record<Permission, string> = {
  "project.view": "ver el proyecto",
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

      return {
        ...initial(),
        source: isRemote ? "remote" : "local",
        loadState: isRemote ? "idle" : "ready",
        loadError: null,

        load: async () => {
          if (!isRemote) return;
          if (get().loadState === "idle") set({ loadState: "loading" });
          try {
            const b = await api.loadProjectBundle(get().projectId);
            set({ ...b, loadState: "ready", loadError: null });
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
