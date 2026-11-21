"use client";

import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { Box, FileText, Layers, ListChecks, Map, Package } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useUI } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useCatalog } from "@/hooks/useCatalog";
import { ELEMENT_LIST, ELEMENT_TYPE_LABEL } from "@/lib/house/spec";
import { Kbd } from "@/components/ui/primitives";

/**
 * Command Palette global (⌘K / Ctrl+K). Busca en proyectos, actividades, planos,
 * materiales, cotizaciones y elementos del modelo 3D de los datos de demostración.
 */
export function SearchCommand() {
  const { materials, blueprints, projects } = useCatalog();
  const open = useUI((s) => s.commandOpen);
  const setOpen = useUI((s) => s.setCommandOpen);
  const tasks = useProjectStore((s) => s.tasks);
  const quotes = useProjectStore((s) => s.quotes);
  const stages = useProjectStore((s) => s.stages);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUI.getState().setCommandOpen(!useUI.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    // Deja que el diálogo se cierre antes de abrir el siguiente panel
    requestAnimationFrame(fn);
  };
  const ui = useUI.getState;
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-[60] bg-[#0b1f17]/40" />
        <Dialog.Content
          className="anim-modal fixed top-[38%] left-1/2 z-[60] w-[calc(100vw-24px)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-lg)] ring-1 ring-black/5"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Buscar en RC Engineering OS</Dialog.Title>
          <Command label="Buscar" loop>
            <div className="flex items-center gap-3 border-b border-line/70 px-5">
              <Command.Input
                autoFocus
                placeholder="Buscar proyectos, actividades, planos, materiales, elementos…"
                className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="scroll-thin max-h-[420px] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase">
              <Command.Empty className="px-4 py-10 text-center text-[14px] text-ink-2">Sin resultados en los datos de demostración.</Command.Empty>

              <Command.Group heading="Proyectos">
                {projects.map((p) => (
                  <Item key={p.id} value={`proyecto ${p.code} ${p.name} ${p.city}`} icon={<Layers size={16} />} title={`${p.code} · ${p.name}`} meta={p.hasDemoData ? `${p.city} · activo` : "Sin datos en la demo"} onSelect={() => run(() => ui().openModule("projects"))} />
                ))}
              </Command.Group>

              <Command.Group heading="Planos">
                {blueprints.map((b) => (
                  <Item key={b.id} value={`plano ${b.code} ${b.title}`} icon={<Map size={16} />} title={`${b.code} · ${b.title}`} meta="Ilustrativo" onSelect={() => run(() => ui().openBlueprints(b.id))} />
                ))}
              </Command.Group>

              <Command.Group heading="Materiales">
                {materials.map((m) => (
                  <Item key={m.id} value={`material ${m.name} ${m.spec}`} icon={<Package size={16} />} title={m.name} meta={m.spec} onSelect={() => run(() => ui().setMaterialDetailId(m.id))} />
                ))}
              </Command.Group>

              <Command.Group heading="Cotizaciones">
                {quotes.map((q) => (
                  <Item key={q.id} value={`cotizacion ${q.code} ${q.title} ${q.clientName}`} icon={<FileText size={16} />} title={`${q.code} · ${q.title}`} meta={q.clientName} onSelect={() => run(() => ui().openModule("quotes"))} />
                ))}
              </Command.Group>

              <Command.Group heading="Elementos del modelo 3D">
                {ELEMENT_LIST.filter((e) => e.type !== "footing").map((e) => (
                  <Item key={e.id} value={`elemento ${e.id} ${e.name} ${ELEMENT_TYPE_LABEL[e.type]}`} icon={<Box size={16} />} title={`${e.id} · ${e.name}`} meta={ELEMENT_TYPE_LABEL[e.type]} onSelect={() => run(() => ui().focusElement(e.id))} />
                ))}
              </Command.Group>

              <Command.Group heading="Actividades">
                {tasks.map((t) => (
                  <Item key={t.id} value={`actividad ${t.id} ${t.title} ${t.category}`} icon={<ListChecks size={16} />} title={t.title} meta={stageName(t.stageId)} onSelect={() => run(() => ui().openStage(t.stageId, t.id))} />
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Item({ value, icon, title, meta, onSelect }: { value: string; icon: ReactNode; title: string; meta?: string; onSelect: () => void }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] text-ink data-[selected=true]:bg-surface-2"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-brand">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {meta && <span className="max-w-[40%] shrink-0 truncate text-[12px] text-ink-3">{meta}</span>}
    </Command.Item>
  );
}
