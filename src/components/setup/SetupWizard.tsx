"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CircleDashed, Minus, X } from "lucide-react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/stores/projectStore";
import { useUI } from "@/stores/uiStore";
import { SETUP_STEPS, setupProgress, type SetupStepId } from "@/lib/setup";
import { cn } from "@/lib/format";
import { GlassButton, ProgressBar } from "@/components/ui/primitives";
import { BudgetStep, GeneralStep, InventoryStep, QuotesStep, StagesStep, TasksStep, TeamStep } from "./steps";

const APPLE = [0.32, 0.72, 0, 1] as const;

export function useSetupProgress() {
  const d = useProjectStore(
    useShallow((s) => ({
      projectId: s.projectId,
      projects: s.projects,
      members: s.members,
      stages: s.stages,
      tasks: s.tasks,
      approvedBudget: s.approvedBudget,
      expenses: s.expenses,
      materials: s.materials,
      quotes: s.quotes,
    })),
  );
  return useMemo(() => {
    const project = d.projects.find((p) => p.id === d.projectId);
    return { project, ...setupProgress({ ...d, project }) };
  }, [d]);
}

/** Asistente paso a paso para cargar un proyecto real. */
export function SetupWizard() {
  const { open, step, creating } = useUI((s) => s.setup);
  const close = useUI((s) => s.closeSetup);
  const setStep = useUI((s) => s.setSetupStep);
  const progress = useSetupProgress();
  const hasProject = !!progress.project && !creating;

  const index = SETUP_STEPS.findIndex((s) => s.id === step);
  const current = SETUP_STEPS[index];
  const go = (delta: number) => {
    const next = SETUP_STEPS[index + delta];
    if (next) setStep(next.id);
  };
  const statusOf = (id: SetupStepId) => progress.statuses.find((s) => s.step.id === id)?.status ?? "pending";

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-[#0b1f17]/40" />
        <Dialog.Content className="anim-modal fixed top-1/2 left-1/2 z-50 flex h-[min(94dvh,920px)] w-[calc(100vw-16px)] max-w-[1180px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white shadow-[var(--shadow-lg)] md:flex-row">
          {/* Riel de pasos */}
          <aside className="shrink-0 border-b border-line/70 bg-surface-2/50 p-5 md:w-[300px] md:border-r md:border-b-0 md:p-6">
            <Dialog.Title className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{hasProject ? "Completa tu proyecto" : "Nuevo proyecto"}</Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-ink-2">{hasProject ? progress.project!.name : "Empieza por la información general"}</Dialog.Description>
            {hasProject && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-medium text-ink">
                    {progress.resolved} de {progress.total} pasos
                  </span>
                  <span className="tabular font-semibold text-brand">{Math.round(progress.fraction * 100)} %</span>
                </div>
                <ProgressBar value={progress.fraction} className="mt-2" height={7} label="Progreso de configuración" />
              </div>
            )}
            <ol className="mt-5 flex gap-1 overflow-x-auto md:block md:space-y-1 md:overflow-visible">
              {SETUP_STEPS.map((s, i) => {
                const st = statusOf(s.id);
                const active = s.id === step;
                const locked = !hasProject && s.id !== "general";
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      disabled={locked}
                      onClick={() => setStep(s.id)}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45",
                        active ? "bg-white shadow-[var(--shadow-sm)] ring-1 ring-line" : "hover:bg-white/70",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
                          st === "done" ? "bg-brand text-white" : st === "skipped" ? "bg-surface-3 text-ink-3" : active ? "bg-accent-soft text-brand ring-1 ring-accent/40" : "bg-white text-ink-3 ring-1 ring-line",
                        )}
                      >
                        {st === "done" ? <Check size={14} strokeWidth={3} /> : st === "skipped" ? <Minus size={14} /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block text-[13px] font-medium", active ? "text-ink" : "text-ink-2")}>
                          <span className="md:hidden">{s.short}</span>
                          <span className="hidden md:inline">{s.title}</span>
                        </span>
                        <span className="hidden text-[11px] text-ink-3 md:block">{st === "done" ? "Completo" : st === "skipped" ? "No aplica" : s.optional ? "Opcional" : "Pendiente"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* Contenido del paso */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex items-start gap-4 border-b border-line/70 px-6 pt-5 pb-4 sm:px-8">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">
                  Paso {index + 1} de {SETUP_STEPS.length}
                  {current.optional && " · opcional"}
                </p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">{current.title}</h2>
                <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-ink-2">{current.why}</p>
              </div>
              <Dialog.Close className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label="Cerrar asistente">
                <X size={18} />
              </Dialog.Close>
            </header>

            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={`${step}-${hasProject}`} initial={{ opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(6px)" }} transition={{ duration: 0.4, ease: APPLE }}>
                  {step === "general" && <GeneralStep creating={!hasProject} onSaved={() => go(1)} />}
                  {hasProject && step === "team" && <TeamStep />}
                  {hasProject && step === "stages" && <StagesStep />}
                  {hasProject && step === "tasks" && <TasksStep />}
                  {hasProject && step === "budget" && <BudgetStep />}
                  {hasProject && step === "inventory" && <InventoryStep />}
                  {hasProject && step === "quotes" && <QuotesStep />}
                </motion.div>
              </AnimatePresence>
            </div>

            {hasProject && (
              <footer className="flex flex-wrap items-center gap-2 border-t border-line/70 bg-surface-2/40 px-6 py-3.5 sm:px-8">
                <GlassButton variant="ghost" size="md" icon={<ArrowLeft size={16} />} onClick={() => go(-1)} disabled={index === 0}>
                  Anterior
                </GlassButton>
                <StepStatusText status={statusOf(step)} />
                <div className="ml-auto flex gap-2">
                  {current.optional && statusOf(step) === "pending" && <SkipButton step={step} onDone={() => go(1)} />}
                  {index < SETUP_STEPS.length - 1 ? (
                    <GlassButton variant="primary" size="md" trailing={<ArrowRight size={16} />} onClick={() => go(1)}>
                      Siguiente
                    </GlassButton>
                  ) : (
                    <GlassButton variant="primary" size="md" icon={<Check size={16} />} onClick={close}>
                      {progress.complete ? "Finalizar" : "Cerrar"}
                    </GlassButton>
                  )}
                </div>
              </footer>
            )}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepStatusText({ status }: { status: string }) {
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#13704a]">
        <Check size={15} /> Paso completo
      </span>
    );
  if (status === "skipped") return <span className="text-[13px] text-ink-3">Marcado como “no aplica”</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
      <CircleDashed size={15} /> Pendiente
    </span>
  );
}

function SkipButton({ step, onDone }: { step: SetupStepId; onDone: () => void }) {
  const setSkipped = useProjectStore((s) => s.setStepSkipped);
  return (
    <GlassButton
      variant="outline"
      size="md"
      onClick={async () => {
        if (await setSkipped(step, true)) onDone();
      }}
    >
      No aplica
    </GlassButton>
  );
}
