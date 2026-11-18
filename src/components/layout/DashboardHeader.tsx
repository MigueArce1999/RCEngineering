"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Plus } from "lucide-react";
import { projects } from "@/data/demo";
import { useUI } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { GlassButton, StatusBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

export function WelcomeHeading() {
  return (
    <div>
      <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">Bienvenido</h1>
      <p className="mt-2 max-w-[360px] text-[14px] leading-[1.45] text-ink-2">
        Gestiona tus proyectos de ingeniería, construcción y arquitectura desde un solo lugar.
      </p>
    </div>
  );
}

export function HeaderActions() {
  const setQuickQuoteOpen = useUI((s) => s.setQuickQuoteOpen);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <ProjectSelector />
      <GlassButton variant="primary" size="lg" icon={<Plus size={18} strokeWidth={2} />} onClick={() => setQuickQuoteOpen(true)} className="px-5">
        Cotización rápida
      </GlassButton>
    </div>
  );
}

export function ProjectSelector() {
  const projectId = useProjectStore((s) => s.projectId);
  const active = projects.find((p) => p.id === projectId)!;
  const toast = useUI((s) => s.toast);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="glass flex h-12 items-center gap-3 rounded-[14px] pr-3 pl-4 text-left transition hover:bg-white/85" aria-label="Seleccionar proyecto activo">
          <span className="flex flex-col">
            <span className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">Proyecto activo</span>
            <span className="text-[14px] font-semibold text-ink">{active.name}</span>
          </span>
          <ChevronDown size={16} className="text-ink-2" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="anim-pop glass-float z-50 w-[320px] rounded-[20px] p-2">
          <p className="px-3 pt-2 pb-1.5 text-[12px] font-medium text-ink-3">Proyectos</p>
          {projects.map((p) => (
            <Popover.Close asChild key={p.id}>
              <button
                onClick={() => {
                  if (!p.hasDemoData) toast({ title: `${p.code} sin datos de demostración`, description: "Solo RC-001 tiene datos cargados en esta versión.", tone: "info" });
                }}
                className={cn("flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-white/80", !p.hasDemoData && "opacity-70")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{p.name}</span>
                  <span className="block text-[12px] text-ink-2">
                    {p.code} · {p.city} · {p.type}
                  </span>
                </span>
                {p.id === projectId ? <Check size={16} className="text-accent" /> : !p.hasDemoData && <StatusBadge dot={false}>Sin datos</StatusBadge>}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
