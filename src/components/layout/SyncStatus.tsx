"use client";

import { CloudOff, Database, HardDrive, Loader2 } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useAuth } from "@/stores/authStore";
import { cn } from "@/lib/format";

/** Indicador del origen de datos: Supabase (sincronizado / cargando / error) o modo local. */
export function SyncStatus({ className }: { className?: string }) {
  const source = useProjectStore((s) => s.source);
  const state = useProjectStore((s) => s.loadState);
  const error = useProjectStore((s) => s.loadError);
  const reload = useProjectStore((s) => s.load);
  const isEditor = useAuth((s) => s.isEditor);

  if (source === "local")
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <HardDrive size={13} /> Modo local · datos en este navegador
      </span>
    );
  if (state === "error")
    return (
      <button onClick={() => void reload()} className={cn("inline-flex items-center gap-1.5 text-danger hover:underline", className)} title={error ?? undefined}>
        <CloudOff size={13} /> Sin conexión con Supabase · reintentar
      </button>
    );
  if (state !== "ready")
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <Loader2 size={13} className="animate-spin" /> Sincronizando con Supabase…
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Database size={13} className="text-accent" /> Supabase · {isEditor ? "edición habilitada" : "solo lectura"}
    </span>
  );
}
