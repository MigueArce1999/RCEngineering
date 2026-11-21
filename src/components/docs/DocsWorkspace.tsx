"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { Camera, Layers3, UsersRound, X } from "lucide-react";
import { useEffect } from "react";
import { useUI, type DocsTab } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useCan } from "@/stores/authStore";
import { useDocs } from "@/stores/docsStore";
import { isRemote } from "@/lib/supabase";
import { cn } from "@/lib/format";
import { Deferred } from "@/components/ui/overlays";
import { BlueprintsTab } from "./BlueprintsTab";
import { PhotosTab } from "./PhotosTab";
import { SharesTab } from "./SharesTab";

/** Módulo "Planos y obra": planos del proyecto, registro fotográfico y enlaces de invitado. */
export function DocsWorkspace() {
  const open = useUI((s) => s.blueprintOpen);
  const close = useUI((s) => s.closeBlueprints);
  const tab = useUI((s) => s.docsTab);
  const setTab = useUI((s) => s.setDocsTab);
  const requested = useUI((s) => s.blueprintId);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === s.projectId));
  const bpCount = useProjectStore((s) => s.blueprints.length);
  const photoCount = useDocs((s) => s.photos.length);
  const canShare = useCan("projects.manage");
  const clearJobs = useDocs((s) => s.clearFinishedJobs);

  const tabs: { key: DocsTab; label: string; short?: string; icon: typeof Layers3; count?: number }[] = [
    { key: "blueprints", label: "Planos", icon: Layers3, count: bpCount },
    ...(isRemote ? [{ key: "photos" as const, label: "Fotos de obra", short: "Fotos", icon: Camera, count: photoCount || undefined }] : []),
    ...(isRemote && canShare ? [{ key: "guests" as const, label: "Invitados", icon: UsersRound }] : []),
  ];
  // Las fotos se piden al abrir (para el contador y para que la pestaña abra al instante)
  const loadPhotos = useDocs((s) => s.loadPhotos);
  useEffect(() => {
    if (open && isRemote) void loadPhotos();
  }, [open, loadPhotos]);

  const active = tabs.some((t) => t.key === tab) ? tab : "blueprints";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          close();
          clearJobs();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-[#0b1f17]/40" />
        <Dialog.Content onOpenAutoFocus={(e) => e.preventDefault()} className="anim-modal fixed top-1/2 left-1/2 z-50 flex h-[min(94dvh,960px)] w-[calc(100vw-16px)] max-w-[1440px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white shadow-[var(--shadow-lg)] outline-none focus-visible:outline-none">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line/70 px-5 py-3.5 sm:px-7">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-accent-soft text-brand">
              <Layers3 size={21} strokeWidth={1.7} />
            </span>
            <div className="min-w-[160px] flex-1">
              <Dialog.Title className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Planos y obra</Dialog.Title>
              <Dialog.Description className="text-[13px] text-ink-2">{project?.name ?? "Proyecto"} · planos, registro fotográfico e invitados</Dialog.Description>
            </div>
            <div className="order-last flex w-full gap-1 rounded-full bg-surface-2 p-1 sm:order-none sm:w-auto" role="tablist" aria-label="Sección">
              {tabs.map((t) => (
                <button key={t.key} role="tab" aria-selected={active === t.key} onClick={() => setTab(t.key)} className={cn("relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors sm:flex-none", active === t.key ? "text-ink" : "text-ink-2 hover:text-ink")}>
                  {active === t.key && <motion.span layoutId="docs-tab" className="absolute inset-0 rounded-full bg-white shadow-[var(--shadow-sm)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <t.icon size={15} className="relative hidden shrink-0 sm:block" />
                  <span className="relative whitespace-nowrap">
                    {t.short ? (
                      <>
                        <span className="sm:hidden">{t.short}</span>
                        <span className="hidden sm:inline">{t.label}</span>
                      </>
                    ) : (
                      t.label
                    )}
                  </span>
                  {t.count ? <span className="tabular relative rounded-full bg-surface-2 px-1.5 text-[11px] text-ink-2">{t.count}</span> : null}
                </button>
              ))}
            </div>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label="Cerrar">
              <X size={18} />
            </Dialog.Close>
          </header>
          {open && (
            <Deferred>
              {active === "blueprints" && <BlueprintsTab initialId={requested} />}
              {active === "photos" && <PhotosTab />}
              {active === "guests" && <SharesTab />}
            </Deferred>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
