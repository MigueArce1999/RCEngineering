"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChartColumn, ChevronDown, MapPin, Minus } from "lucide-react";
import { useProjectData } from "@/hooks/useProjectData";
import { useUI } from "@/stores/uiStore";
import { STAGE_STATUS_LABEL } from "@/lib/domain";
import { formatNumber, formatPct } from "@/lib/format";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { GlassCard, ProgressBar, StatusBadge } from "@/components/ui/primitives";

/** Tarjeta flotante de cristal con la ficha del proyecto activo (sobre el visor 3D). */
export function ProjectInfoCard() {
  const { project, overall, current, progressByStage } = useProjectData();
  const collapsed = useUI((s) => s.infoCardCollapsed);
  const setCollapsed = useUI((s) => s.setInfoCardCollapsed);
  const openDetail = useUI((s) => s.setProjectDetailOpen);

  return (
    <GlassCard variant="float" className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/80 text-brand shadow-[inset_0_0_0_1px_rgb(16_41_31/0.06)]" aria-hidden>
          <ChartColumn size={19} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">Proyecto: {project.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-2">
            <MapPin size={12} /> {project.city}, {project.country}
          </p>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="grid h-8 w-8 place-items-center rounded-full text-ink-2 transition hover:bg-white"
          aria-label={collapsed ? "Expandir información del proyecto" : "Minimizar información del proyecto"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown size={17} /> : <Minus size={17} />}
        </button>
      </div>

      <div className="px-5 pb-1">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink">Avance físico general</span>
          <span className="tabular font-semibold text-ink"><AnimatedNumber value={overall} format={formatPct} /></span>
        </div>
        <ProgressBar value={overall} className="mt-2" label="Avance físico general" />
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <dl className="space-y-2 px-5 pt-3 text-[13px]">
              <Row label="Etapa actual" value={current ? `Etapa ${current.order} — ${STAGE_STATUS_LABEL[progressByStage[current.id].status]}` : "Sin etapas definidas"} />
              <div className="flex items-center justify-between">
                <dt className="text-ink-2">Estado</dt>
                <dd>
                  <StatusBadge tone={project.status === "active" ? "success" : "neutral"}>{project.status === "active" ? "Activo" : "Pausado"}</StatusBadge>
                </dd>
              </div>
            </dl>
            <div className="hairline mx-5 my-3" />
            <dl className="space-y-2 px-5 text-[13px]">
              <Row label="Tipo de proyecto" value={project.type} />
              <Row label="Área de construcción" value={project.builtAreaM2 ? `${formatNumber(project.builtAreaM2)} m²` : "—"} />
              <Row label="Niveles" value={String(project.levels)} />
              <Row label="Sistema estructural" value={project.structuralSystem || "—"} />
            </dl>
            <div className="p-4 pt-4">
              <button
                onClick={() => openDetail(true)}
                className="glass flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-medium text-ink transition hover:bg-white"
              >
                Ver detalle del proyecto <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {collapsed && <div className="h-4" />}
    </GlassCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
