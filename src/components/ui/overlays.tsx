"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as RTooltip from "@radix-ui/react-tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { useUI } from "@/stores/uiStore";

// ── Modal ───────────────────────────────────────────────────────────────
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 720,
  className,
  bodyClassName,
  headerExtra,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
  bodyClassName?: string;
  headerExtra?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-[#0b1f17]/30 backdrop-blur-[6px]" />
        <Dialog.Content
          className={cn(
            "anim-modal fixed top-1/2 left-1/2 z-50 flex max-h-[min(92vh,900px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[24px] bg-white/95 shadow-[var(--shadow-lg)] ring-1 ring-black/5 backdrop-blur-xl focus:outline-none",
            className,
          )}
          style={{ maxWidth: width }}
        >
          <div className="flex items-start gap-4 border-b border-line/70 px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[18px] font-semibold tracking-[-0.015em] text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-[13px] text-ink-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Diálogo</Dialog.Description>}
            </div>
            {headerExtra}
            <Dialog.Close className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label="Cerrar">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className={cn("scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5", bodyClassName)}>{children}</div>
          {footer && <div className="flex flex-wrap items-center gap-2 border-t border-line/70 bg-surface-2/40 px-6 py-3.5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Drawer lateral ──────────────────────────────────────────────────────
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = 560,
  header,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  width?: number;
  header?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-[#0b1f17]/20 backdrop-blur-[3px]" />
        <Dialog.Content
          className="anim-drawer fixed top-2 right-2 bottom-2 z-50 flex w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[24px] bg-white/96 shadow-[var(--shadow-lg)] ring-1 ring-black/5 backdrop-blur-xl focus:outline-none"
          style={{ maxWidth: width }}
        >
          <div className="flex items-start gap-3 px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[18px] font-semibold tracking-[-0.015em] text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-[13px] text-ink-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Panel</Dialog.Description>}
            </div>
            <Dialog.Close className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink" aria-label="Cerrar panel">
              <X size={18} />
            </Dialog.Close>
          </div>
          {header}
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Tooltip ─────────────────────────────────────────────────────────────
export function Tooltip({ content, children, side = "bottom" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <RTooltip.Root delayDuration={350}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={8}
          className="anim-pop z-[70] max-w-64 rounded-[10px] bg-[#10291f]/92 px-2.5 py-1.5 text-[12px] leading-snug font-medium text-white shadow-[var(--shadow-md)] backdrop-blur-md"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export const TooltipProvider = RTooltip.Provider;

// ── Toaster ─────────────────────────────────────────────────────────────
export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="glass-float pointer-events-auto flex items-start gap-3 rounded-[16px] px-4 py-3"
          >
            <span className="mt-0.5">
              {t.tone === "warning" ? <TriangleAlert size={18} className="text-warning" /> : t.tone === "info" ? <Info size={18} className="text-info" /> : <CheckCircle2 size={18} className="text-accent" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[13px] text-ink-2">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink" aria-label="Cerrar notificación">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
