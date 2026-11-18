"use client";

import { useMemo } from "react";
import { useProjectStore, sortedStages } from "@/stores/projectStore";
import { currentStage, overallProgress, stageProgress } from "@/lib/domain";
import { projects } from "@/data/demo";

/** Selectores derivados del proyecto activo, memorizados sobre el estado de la tienda. */
export function useProjectData() {
  const stages = useProjectStore((s) => s.stages);
  const tasks = useProjectStore((s) => s.tasks);
  const projectId = useProjectStore((s) => s.projectId);

  return useMemo(() => {
    const ordered = sortedStages(stages);
    const progressByStage = Object.fromEntries(ordered.map((s) => [s.id, stageProgress(s.id, tasks)]));
    const project = projects.find((p) => p.id === projectId) ?? projects[0];
    return {
      project,
      stages: ordered,
      tasks,
      progressByStage,
      overall: overallProgress(ordered, tasks),
      current: currentStage(ordered, tasks),
    };
  }, [stages, tasks, projectId]);
}
