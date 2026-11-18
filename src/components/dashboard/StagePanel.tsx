"use client";

import { motion } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import { ChevronRight, Compass, DraftingCompass, HardHat, Info, Layers, PaintRoller, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ConstructionStage, StageIcon } from "@/types";
import { cn } from "@/lib/format";
import { STAGE_STATUS_LABEL, type StageProgress } from "@/lib/domain";
import { useProjectData } from "@/hooks/useProjectData";
import { useUI } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { GlassButton, ProgressBar } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";

export const STAGE_ICONS: Record<StageIcon, typeof Compass> = {
  survey: Compass,
  design: DraftingCompass,
  build: HardHat,
  finish: PaintRoller,
  generic: Layers,
};

export function StagePanel() {
  const { stages, progressByStage } = useProjectData();
  const selected = useUI((s) => s.selectedStageId);
  const openStage = useUI((s) => s.openStage);

  return (
    <section aria-labelledby="stages-title" className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="stages-title" className="text-[17px] font-semibold tracking-[-0.015em] text-ink">
          Etapas del proyecto
        </h2>
        <Tooltip content="El avance de cada etapa se calcula con sus actividades completadas. El avance general pondera cada etapa por su peso en el presupuesto de obra.">
          <button className="text-ink-3 transition hover:text-ink-2" aria-label="Cómo se calcula el avance">
            <Info size={16} />
          </button>
        </Tooltip>
        <AddStageButton />
      </div>
      <ol className="scroll-thin -mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 pt-0.5 pb-2">
        {stages.map((stage, i) => (
          <motion.li
            key={stage.id}
            layout
            initial={{ opacity: 0, x: -14, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.25 + 0.08 * i, ease: [0.32, 0.72, 0, 1] }}
          >
            <StageCard stage={stage} progress={progressByStage[stage.id]} active={selected === stage.id} onOpen={() => openStage(stage.id)} />
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

export function StageCard({ stage, progress, active, onOpen }: { stage: ConstructionStage; progress: StageProgress; active: boolean; onOpen: () => void }) {
  const Icon = STAGE_ICONS[stage.icon];
  return (
    <button
      onClick={onOpen}
      aria-current={active ? "true" : undefined}
      aria-label={`Etapa ${stage.order}: ${stage.name}. ${STAGE_STATUS_LABEL[progress.status]}. ${progress.done} de ${progress.total} actividades completadas. Abrir detalle.`}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-[18px] p-3.5 text-left transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px active:scale-[0.99]",
        active ? "glass-brand" : "surface-card hover:shadow-[var(--shadow-lg)]",
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-[13px]",
          active ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),inset_0_0_0_1px_rgb(255_255_255/0.12)]" : "bg-surface-2 text-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.9)]",
        )}
        aria-hidden
      >
        <Icon size={21} strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className={cn("truncate text-[15px] font-semibold tracking-[-0.01em]", active ? "text-white" : "text-ink")}>
            Etapa {stage.order} — {STAGE_STATUS_LABEL[progress.status]}
          </span>
        </span>
        <span className={cn("mt-0.5 block truncate text-[13px]", active ? "text-white/75" : "text-ink-2")}>{stage.name}</span>
        <span className="mt-2 flex items-center gap-3">
          <ProgressBar value={progress.progress} tone={active ? "light" : "brand"} height={5} label={`Avance etapa ${stage.order}`} />
          <span className={cn("tabular shrink-0 text-[12px] font-medium", active ? "text-white/90" : "text-ink-2")}>
            {progress.done} de {progress.total}
          </span>
        </span>
        <span className={cn("mt-1.5 block text-[12px]", active ? "text-white/70" : "text-ink-3")}>Trabajos pendientes ({progress.pending})</span>
      </span>
      <ChevronRight size={18} className={cn("shrink-0 transition-transform duration-200 group-hover:translate-x-0.5", active ? "text-white/80" : "text-ink-3")} />
    </button>
  );
}

function AddStageButton() {
  const addStage = useProjectStore((s) => s.addStage);
  const openStage = useUI((s) => s.openStage);
  const toast = useUI((s) => s.toast);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = addStage(name.trim());
    if (!id) return;
    setName("");
    setOpen(false);
    toast({ title: "Etapa creada", description: name.trim() });
    openStage(id);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip content="Agregar etapa">
        <Popover.Trigger asChild>
          <button className="ml-auto grid h-8 w-8 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label="Agregar etapa">
            <Plus size={17} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="anim-pop glass-float z-50 w-72 rounded-[18px] p-3">
          <form onSubmit={submit} className="space-y-2.5">
            <label className="block text-[12px] font-medium text-ink-2" htmlFor="new-stage">
              Nombre de la nueva etapa
            </label>
            <input
              id="new-stage"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Obras exteriores"
              className="h-10 w-full rounded-[12px] border border-line bg-white px-3 text-[14px] outline-none focus:border-accent"
            />
            <GlassButton type="submit" variant="primary" size="sm" className="w-full justify-center" disabled={!name.trim()}>
              Crear etapa
            </GlassButton>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
