"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Pencil, Plus, Share2 } from "lucide-react";
import { useCatalog } from "@/hooks/useCatalog";
import { useCan } from "@/stores/authStore";
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
  const openDocs = useUI((s) => s.openDocs);
  const remote = useProjectStore((s) => s.source === "remote");
  const canShare = useCan("projects.manage");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 sm:flex sm:flex-wrap sm:justify-end">
      <ProjectSelector />
      {remote && canShare && (
        <GlassButton variant="glass" size="lg" icon={<Share2 size={17} />} onClick={() => openDocs("guests")} className="h-12 w-12 justify-center px-0 sm:w-auto sm:px-4" aria-label="Compartir con invitados">
          <span className="hidden sm:inline">Compartir</span>
        </GlassButton>
      )}
      <GlassButton variant="primary" size="lg" icon={<Plus size={18} strokeWidth={2} />} onClick={() => setQuickQuoteOpen(true)} className="col-span-2 w-full justify-center px-5 sm:w-auto">
        Cotización rápida
      </GlassButton>
    </div>
  );
}

export function ProjectSelector() {
  const { projects } = useCatalog();
  const projectId = useProjectStore((s) => s.projectId);
  const remote = useProjectStore((s) => s.source === "remote");
  const selectProject = useProjectStore((s) => s.selectProject);
  const openSetup = useUI((s) => s.openSetup);
  const canCreate = useCan("projects.manage");
  const active = projects.find((p) => p.id === projectId);
  const toast = useUI((s) => s.toast);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="glass flex h-12 w-full min-w-0 items-center sm:max-w-[280px] gap-3 rounded-[14px] pr-3 pl-4 text-left transition hover:bg-white/85" aria-label="Seleccionar proyecto activo">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">Proyecto activo</span>
            <span className="truncate text-[14px] font-semibold text-ink">{active?.name ?? "Sin proyecto"}</span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-ink-2" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="anim-pop glass-float z-50 w-[340px] rounded-[20px] p-2">
          <p className="px-3 pt-2 pb-1.5 text-[12px] font-medium text-ink-3">Proyectos</p>
          <div className="scroll-thin max-h-[320px] overflow-y-auto">
            {projects.map((p) => (
              <Popover.Close asChild key={p.id}>
                <button
                  onClick={() => {
                    if (remote) {
                      if (p.id !== projectId) void selectProject(p.id);
                    } else if (!p.hasDemoData) toast({ title: `${p.code} sin datos de demostración`, description: "Solo RC-001 tiene datos cargados en el modo local.", tone: "info" });
                  }}
                  className={cn("flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-white/80", !remote && !p.hasDemoData && "opacity-70")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{p.name}</span>
                    <span className="block truncate text-[12px] text-ink-2">{[p.code, p.city, p.type].filter(Boolean).join(" · ")}</span>
                  </span>
                  {p.id === projectId ? <Check size={16} className="text-accent" /> : !remote && !p.hasDemoData && <StatusBadge dot={false}>Sin datos</StatusBadge>}
                </button>
              </Popover.Close>
            ))}
          </div>
          {(
            <>
              <div className="hairline my-1.5" />
              {active && (
                <Popover.Close asChild>
                  <button onClick={() => openSetup("general")} className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium text-ink transition hover:bg-white/80">
                    <Pencil size={15} className="text-ink-2" /> Editar / completar este proyecto
                  </button>
                </Popover.Close>
              )}
              {remote && canCreate && (
                <Popover.Close asChild>
                  <button onClick={() => openSetup("general", true)} className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium text-brand transition hover:bg-white/80">
                    <Plus size={15} /> Nuevo proyecto
                  </button>
                </Popover.Close>
              )}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
