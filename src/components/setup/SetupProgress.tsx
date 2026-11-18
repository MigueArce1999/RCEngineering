"use client";

import { motion } from "framer-motion";
import { ArrowRight, Building2, Check, ClipboardList, Coins, HardHat, Layers, Package, Users } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useAuth, useCan } from "@/stores/authStore";
import { useUI } from "@/stores/uiStore";
import { SETUP_STEPS } from "@/lib/setup";
import { cn } from "@/lib/format";
import { GlassButton, ProgressBar } from "@/components/ui/primitives";
import { useSetupProgress } from "./SetupWizard";

const APPLE = [0.32, 0.72, 0, 1] as const;
const STEP_ICONS = { general: Building2, team: Users, stages: Layers, tasks: ClipboardList, budget: Coins, inventory: Package, quotes: HardHat };

/** Barra "Completa tu proyecto" en el dashboard. Desaparece cuando todos los pasos están resueltos. */
export function SetupProgressCard() {
  const progress = useSetupProgress();
  const openSetup = useUI((s) => s.openSetup);
  const remote = useProjectStore((s) => s.source === "remote");
  if (!remote || !progress.project || progress.complete) return null;
  const pct = Math.round(progress.fraction * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: -8, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: APPLE }}
      className="surface-card mb-6 flex flex-col gap-4 p-5 lg:flex-row lg:items-center"
      aria-label="Progreso de configuración del proyecto"
    >
      <div className="min-w-0 lg:w-[300px]">
        <p className="text-[15px] font-semibold text-ink">Completa tu proyecto</p>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {progress.resolved} de {progress.total} pasos · siguiente: <strong className="font-medium text-ink">{progress.next?.title}</strong>
        </p>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={progress.fraction} height={7} label="Progreso de configuración" />
          <span className="tabular text-[13px] font-semibold text-brand">{pct} %</span>
        </div>
      </div>
      <ol className="flex flex-1 flex-wrap gap-1.5">
        {progress.statuses.map(({ step, status }) => {
          const Icon = STEP_ICONS[step.id];
          return (
            <li key={step.id}>
              <button
                onClick={() => openSetup(step.id)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition",
                  status === "done" ? "bg-accent-soft text-[#13704a]" : status === "skipped" ? "bg-surface-2 text-ink-3" : "bg-white text-ink-2 ring-1 ring-line hover:text-ink hover:ring-accent",
                )}
              >
                {status === "done" ? <Check size={14} strokeWidth={2.5} /> : <Icon size={14} />}
                {step.short}
              </button>
            </li>
          );
        })}
      </ol>
      <GlassButton variant="primary" size="lg" trailing={<ArrowRight size={17} />} onClick={() => openSetup(progress.next?.id ?? "general")}>
        Continuar
      </GlassButton>
    </motion.section>
  );
}

/** Estado vacío cuando aún no hay proyectos en la base de datos. */
export function NoProjects() {
  const openSetup = useUI((s) => s.openSetup);
  const canCreate = useCan("projects.manage");
  const firstName = useAuth((s) => s.profile?.firstName);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: APPLE }}
      className="surface-card mx-auto mt-6 max-w-[880px] p-8 sm:p-12"
    >
      <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink">{firstName ? `Hola, ${firstName}` : "Bienvenido"}</h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-ink-2">
        {canCreate ? "Aún no hay proyectos. Te guiaremos paso a paso para cargar tu primera obra con toda su información." : "Aún no hay proyectos cargados. Cuando un administrador o director cree uno, lo verás aquí."}
      </p>
      <ol className="mt-8 grid gap-3 sm:grid-cols-2">
        {SETUP_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[s.id];
          return (
            <li key={s.id} className="flex gap-3 rounded-[16px] bg-surface-2/60 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white text-brand ring-1 ring-line">
                <Icon size={17} />
              </span>
              <span>
                <span className="block text-[14px] font-medium text-ink">
                  {i + 1}. {s.title}
                  {s.optional && <span className="ml-1.5 text-[11px] font-normal text-ink-3">opcional</span>}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-ink-2">{s.why}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {canCreate && (
        <GlassButton variant="primary" size="lg" className="mt-8" trailing={<ArrowRight size={17} />} onClick={() => openSetup("general", true)}>
          Crear mi primer proyecto
        </GlassButton>
      )}
    </motion.section>
  );
}
