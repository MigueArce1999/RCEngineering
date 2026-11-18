"use client";

import { Box, FileText, ListChecks, X } from "lucide-react";
import { useMemo } from "react";
import { ELEMENT_INDEX, ELEMENT_TYPE_LABEL, LEVEL_LABEL } from "@/lib/house/spec";
import { ELEMENT_STATUS_LABEL, elementBuildStatus, tasksForElement } from "@/lib/domain";
import { formatCOP, formatNumber, cn } from "@/lib/format";
import { useUI } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { blueprints } from "@/data/demo";
import { GlassCard, StatusBadge } from "@/components/ui/primitives";

/** Panel de propiedades del elemento arquitectónico seleccionado en el visor. */
export function ElementInspector({ compact = false }: { compact?: boolean }) {
  const id = useUI((s) => s.selectedElementId);
  const select = useUI((s) => s.selectElement);
  const openStage = useUI((s) => s.openStage);
  const openBlueprints = useUI((s) => s.openBlueprints);
  const tasks = useProjectStore((s) => s.tasks);
  const stages = useProjectStore((s) => s.stages);
  const el = id ? ELEMENT_INDEX[id] : null;

  const linked = useMemo(() => (el ? tasksForElement(el, tasks) : []), [el, tasks]);
  if (!el) return null;
  const status = elementBuildStatus(el.id, tasks);
  const stage = stages.find((s) => s.id === el.stageId);
  const bps = blueprints.filter((b) => el.blueprintIds.includes(b.id));
  const [w, h, d] = el.size;

  return (
    <GlassCard variant="float" className={cn("flex max-h-full flex-col overflow-hidden", compact ? "max-h-[46vh]" : "")}>
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-surface-2 text-brand" aria-hidden>
          <Box size={19} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            {ELEMENT_TYPE_LABEL[el.type]} · {el.id}
          </p>
          <h3 className="mt-0.5 text-[15px] leading-snug font-semibold text-ink">{el.name}</h3>
        </div>
        <button onClick={() => select(null)} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 hover:bg-white" aria-label="Cerrar propiedades">
          <X size={16} />
        </button>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <dl className="space-y-2 text-[13px]">
          <Row label="Estado constructivo">
            <StatusBadge tone={status === "built" ? "success" : status === "in_progress" ? "warning" : "neutral"}>{ELEMENT_STATUS_LABEL[status]}</StatusBadge>
          </Row>
          <Row label="Nivel">{LEVEL_LABEL[el.level]}</Row>
          <Row label="Material">
            <span className="text-right">{el.material}</span>
          </Row>
          <Row label="Dimensiones">
            <span className="tabular">
              {formatNumber(w)} × {formatNumber(h)} × {formatNumber(d)} m
            </span>
          </Row>
          <Row label="Etapa asociada">
            {stage ? (
              <button onClick={() => openStage(stage.id)} className="font-medium text-brand hover:underline">
                Etapa {stage.order} · {stage.name}
              </button>
            ) : (
              "—"
            )}
          </Row>
          {el.estimatedCost !== undefined && (
            <Row label="Costo estimado">
              <span className="tabular font-medium">{formatCOP(el.estimatedCost)}</span>
            </Row>
          )}
        </dl>
        {el.estimatedCost !== undefined && <p className="mt-1 text-[11px] text-ink-3">Costo paramétrico de demostración, no proviene de un APU aprobado.</p>}

        <div className="hairline my-3" />
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
          <ListChecks size={14} /> Actividades vinculadas ({linked.length})
        </p>
        {linked.length === 0 ? (
          <p className="text-[12px] text-ink-3">Sin actividades vinculadas en la programación.</p>
        ) : (
          <ul className="space-y-1">
            {linked.slice(0, 6).map((t) => (
              <li key={t.id}>
                <button onClick={() => openStage(t.stageId, t.id)} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[12px] text-ink transition hover:bg-white">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", t.status === "done" ? "bg-accent" : t.status === "in_progress" ? "bg-warning" : "bg-line-strong")} />
                  <span className="truncate">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
          <FileText size={14} /> Planos relacionados
        </p>
        <div className="flex flex-wrap gap-1.5">
          {bps.map((b) => (
            <button key={b.id} onClick={() => openBlueprints(b.id)} className="h-7 rounded-full bg-white px-2.5 text-[12px] font-medium text-brand ring-1 ring-line transition hover:ring-accent">
              {b.code}
            </button>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-ink-2">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}
