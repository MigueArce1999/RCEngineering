"use client";

import { ArrowRight } from "lucide-react";
import { useUI } from "@/stores/uiStore";
import { useCan } from "@/stores/authStore";
import type { SetupStepId } from "@/lib/setup";

/** Estado vacío de un módulo con acceso directo al paso del asistente que lo completa. */
export function SetupEmpty({ text, step, action }: { text: string; step: SetupStepId; action: string }) {
  const openSetup = useUI((s) => s.openSetup);
  const canEdit = useCan("projects.manage");
  return (
    <div className="mt-3 rounded-[14px] border border-dashed border-line-strong px-4 py-5 text-center">
      <p className="text-[13px] text-ink-2">{text}</p>
      {canEdit && (
        <button onClick={() => openSetup(step)} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand underline-offset-4 hover:underline">
          {action} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
