"use client";

import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/stores/projectStore";

/** Catálogos del proyecto activo (Supabase o demo local). */
export function useCatalog() {
  return useProjectStore(
    useShallow((s) => ({
      projects: s.projects,
      members: s.members,
      materials: s.materials,
      movements: s.movements,
      expenses: s.expenses,
      plannedCurve: s.plannedCurve,
      blueprints: s.blueprints,
      approvedBudget: s.approvedBudget,
    })),
  );
}
