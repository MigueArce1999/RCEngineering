"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ConstructionStage, Quote, Task, TaskStatus } from "@/types";
import { quotes as demoQuotes, stages as demoStages, CURRENT_USER_ID } from "@/data/demo";
import { buildDemoTasks } from "@/data/tasks";
import { uid } from "@/lib/format";

/**
 * Estado de dominio del proyecto activo. Persistido en localStorage en esta fase;
 * las acciones están pensadas para mapearse 1:1 a mutaciones de la API (Supabase).
 */
interface ProjectState {
  projectId: string;
  stages: ConstructionStage[];
  tasks: Task[];
  quotes: Quote[];

  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  toggleTaskDone: (taskId: string) => void;
  addTaskNote: (taskId: string, text: string) => void;
  addTask: (stageId: string, input: Pick<Task, "title" | "description" | "assigneeId" | "dueDate" | "priority">) => string;

  renameStage: (stageId: string, name: string) => void;
  moveStage: (stageId: string, direction: -1 | 1) => void;
  addStage: (name: string) => string;

  saveQuote: (quote: Quote) => void;
  resetDemo: () => void;
}

const initial = () => ({
  projectId: "prj-rc-001",
  stages: demoStages,
  tasks: buildDemoTasks(),
  quotes: demoQuotes,
});

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...initial(),

      setTaskStatus: (taskId, status) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) })),

      toggleTaskDone: (taskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: t.status === "done" ? "pending" : "done" } : t)),
        })),

      addTaskNote: (taskId, text) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, notes: [...t.notes, { id: uid("note"), text, createdAt: new Date().toISOString(), authorId: CURRENT_USER_ID }] }
              : t,
          ),
        })),

      addTask: (stageId, input) => {
        const id = uid("tsk");
        set((s) => ({
          tasks: [...s.tasks, { id, stageId, status: "pending", notes: [], elementIds: [], category: "Personalizada", ...input }],
        }));
        return id;
      },

      renameStage: (stageId, name) =>
        set((s) => ({ stages: s.stages.map((st) => (st.id === stageId ? { ...st, name } : st)) })),

      moveStage: (stageId, direction) => {
        const sorted = [...get().stages].sort((a, b) => a.order - b.order);
        const i = sorted.findIndex((s) => s.id === stageId);
        const j = i + direction;
        if (i < 0 || j < 0 || j >= sorted.length) return;
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
        set({ stages: sorted.map((s, k) => ({ ...s, order: k + 1 })) });
      },

      addStage: (name) => {
        const id = uid("stg");
        set((s) => ({
          stages: [...s.stages, { id, projectId: s.projectId, order: s.stages.length + 1, name, icon: "generic", weight: 0.1 }],
        }));
        return id;
      },

      saveQuote: (quote) =>
        set((s) => {
          const exists = s.quotes.some((q) => q.id === quote.id);
          return { quotes: exists ? s.quotes.map((q) => (q.id === quote.id ? quote : q)) : [...s.quotes, quote] };
        }),

      resetDemo: () => set(initial()),
    }),
    {
      name: "rc-eos-project",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Se rehidrata en el cliente tras el primer render (ver StoreHydrator) para evitar desajustes SSR.
      skipHydration: true,
      partialize: (s) => ({ projectId: s.projectId, stages: s.stages, tasks: s.tasks, quotes: s.quotes }),
    },
  ),
);

export const sortedStages = (stages: ConstructionStage[]) => [...stages].sort((a, b) => a.order - b.order);
