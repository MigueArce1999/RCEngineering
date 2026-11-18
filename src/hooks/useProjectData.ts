"use client";

import { useMemo } from "react";
import { useProjectStore, sortedStages } from "@/stores/projectStore";
import { currentStage, overallProgress, stageProgress } from "@/lib/domain";
import type { Project } from "@/types";

const PLACEHOLDER: Project = {
  id: "",
  code: "",
  name: "Cargando proyecto…",
  city: "",
  country: "",
  type: "",
  builtAreaM2: 0,
  levels: 0,
  structuralSystem: "",
  status: "active",
  startDate: "2026-01-01",
  plannedEndDate: "2026-12-31",
  hasDemoData: false,
};

/** Selectores derivados del proyecto activo, memorizados sobre el estado de la tienda. */
export function useProjectData() {
  const stages = useProjectStore((s) => s.stages);
  const tasks = useProjectStore((s) => s.tasks);
  const projectId = useProjectStore((s) => s.projectId);
  const projects = useProjectStore((s) => s.projects);

  return useMemo(() => {
    const ordered = sortedStages(stages);
    const progressByStage = Object.fromEntries(ordered.map((s) => [s.id, stageProgress(s.id, tasks)]));
    // El dashboard solo se muestra con un proyecto activo; el respaldo evita fallos durante la carga
    const project = projects.find((p) => p.id === projectId) ?? projects[0] ?? PLACEHOLDER;
    return {
      project,
      stages: ordered,
      tasks,
      progressByStage,
      overall: overallProgress(ordered, tasks),
      current: currentStage(ordered, tasks),
    };
  }, [stages, tasks, projectId, projects]);
}
