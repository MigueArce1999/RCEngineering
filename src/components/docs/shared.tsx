"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import type { UploadJob } from "@/stores/docsStore";
import { formatBytes } from "@/lib/docs";
import { cn } from "@/lib/format";

export const inputCls =
  "h-10 w-full rounded-[12px] border border-line bg-white px-3 text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/15 focus-visible:outline-none disabled:bg-surface-2 disabled:text-ink-2";

/** Campo que guarda al salir (o con Enter), sin botón de guardar. */
export function InlineField({ value, onCommit, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }
  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onCommit(v);
    else setDraft(value);
  };
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className={cn(inputCls, className)}
    />
  );
}

/** Botón de eliminar con confirmación en el mismo lugar (segundo clic). */
export function ConfirmDelete({ onConfirm, label = "Eliminar", size = "md", className }: { onConfirm: () => void; label?: string; size?: "sm" | "md"; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all duration-300",
        size === "sm" ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]",
        armed ? "bg-danger text-white shadow-[var(--shadow-sm)]" : "text-ink-2 hover:bg-danger-soft hover:text-danger",
        className,
      )}
    >
      <Trash2 size={size === "sm" ? 13 : 14} />
      {armed ? "¿Seguro? Confirmar" : label}
    </button>
  );
}

/** Capa que aparece al arrastrar archivos sobre el área. */
export function useFileDrop(onFiles: (files: File[]) => void, enabled: boolean) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const has = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files");
  return {
    over,
    bind: enabled
      ? {
          onDragEnter: (e: React.DragEvent) => {
            if (!has(e)) return;
            e.preventDefault();
            depth.current++;
            setOver(true);
          },
          onDragOver: (e: React.DragEvent) => {
            if (!has(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          },
          onDragLeave: () => {
            depth.current = Math.max(0, depth.current - 1);
            if (!depth.current) setOver(false);
          },
          onDrop: (e: React.DragEvent) => {
            if (!has(e)) return;
            e.preventDefault();
            depth.current = 0;
            setOver(false);
            const files = [...e.dataTransfer.files];
            if (files.length) onFiles(files);
          },
        }
      : {},
  };
}

export function DropOverlay({ show, title, hint }: { show: boolean; title: string; hint: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-[22px] border-2 border-dashed border-accent bg-accent-soft/85 backdrop-blur-[2px]"
        >
          <motion.div initial={{ scale: 0.92, y: 8 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 26 }} className="text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-brand text-white shadow-[var(--shadow-md)]">
              <UploadCloud size={30} strokeWidth={1.6} />
            </span>
            <p className="mt-4 text-[18px] font-semibold tracking-[-0.015em] text-ink">{title}</p>
            <p className="mt-1 text-[13px] text-ink-2">{hint}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Tarjeta de un archivo que se está cargando. */
export function UploadRow({ job, compact }: { job: UploadJob; compact?: boolean }) {
  const label = { preparing: "Preparando…", uploading: `${Math.round(job.progress * 100)} %`, saving: "Guardando…", done: "Listo", error: job.error ?? "Error" }[job.stage];
  return (
    <motion.div layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className={cn("flex items-center gap-3 rounded-[14px] bg-white p-2.5 ring-1", job.stage === "error" ? "ring-danger/40" : "ring-line")}>
      <span className="relative grid h-11 w-9 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {job.preview ? <img src={job.preview} alt="" className="h-full w-full object-cover" /> : <Loader2 size={14} className="animate-spin text-ink-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{job.name}</span>
        {!compact && <span className="block text-[11px] text-ink-3">{formatBytes(job.size)}</span>}
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-2">
          <motion.span
            className={cn("block h-full rounded-full", job.stage === "error" ? "bg-danger" : "bg-accent")}
            animate={{ width: `${job.stage === "done" ? 100 : job.stage === "preparing" ? 6 : Math.max(8, job.progress * 100)}%` }}
            transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.35 }}
          />
        </span>
      </span>
      <span className={cn("flex shrink-0 items-center gap-1 text-[11px] font-medium", job.stage === "error" ? "max-w-[140px] text-danger" : job.stage === "done" ? "text-accent" : "text-ink-2")}>
        {job.stage === "done" ? <Check size={13} /> : job.stage === "error" ? <AlertCircle size={13} className="shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </span>
    </motion.div>
  );
}

export function EmptyDrop({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="anim-content grid h-full place-items-center p-8 text-center">
      <div className="max-w-md">
        <motion.span
          className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-accent-soft text-brand"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {icon}
        </motion.span>
        <h3 className="mt-5 text-[20px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
        <div className="mt-2 text-[14px] leading-relaxed text-ink-2">{children}</div>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
