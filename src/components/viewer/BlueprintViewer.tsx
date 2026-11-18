"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { asset } from "@/lib/asset";
import { Maximize2, Minus, Plus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { Blueprint } from "@/types";
import { BLUEPRINT_CATEGORY_LABEL, blueprints } from "@/data/demo";
import { cn } from "@/lib/format";
import { useUI } from "@/stores/uiStore";
import { Tooltip } from "@/components/ui/overlays";

const LEVELS: (Blueprint["level"] | "all")[] = ["all", "N1", "N2", "Cubierta", "General"];
const LEVEL_LABEL: Record<string, string> = { all: "Todos", N1: "Nivel 1", N2: "Nivel 2", Cubierta: "Cubierta", General: "General" };

/**
 * Visor de planos: categorías, selector de nivel y documento, zoom/desplazamiento y pantalla completa.
 * Soporta SVG/PNG (imagen) y PDF (visor nativo del navegador). DWG/DXF/IFC: pendiente de evaluación.
 */
export function BlueprintViewer() {
  const open = useUI((s) => s.blueprintOpen);
  const close = useUI((s) => s.closeBlueprints);
  const requestedId = useUI((s) => s.blueprintId);
  const [category, setCategory] = useState<Blueprint["category"] | "all">("all");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [docId, setDocId] = useState(blueprints[0].id);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Al abrir con un plano concreto (desde inspector o búsqueda), mostrarlo
  const [prevReq, setPrevReq] = useState<string | null>(null);
  if (open && requestedId && requestedId !== prevReq) {
    setPrevReq(requestedId);
    setDocId(requestedId);
    setCategory("all");
    setLevel("all");
    setView({ x: 0, y: 0, k: 1 });
  }

  const list = useMemo(() => blueprints.filter((b) => (category === "all" || b.category === category) && (level === "all" || b.level === level)), [category, level]);
  const doc = blueprints.find((b) => b.id === docId) ?? blueprints[0];

  const selectDoc = (id: string) => {
    setDocId(id);
    setView({ x: 0, y: 0, k: 1 });
  };
  const zoom = (factor: number) => setView((v) => ({ ...v, k: Math.min(8, Math.max(0.4, v.k * factor)) }));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") zoom(1.2);
      if (e.key === "-") zoom(1 / 1.2);
      if (e.key === "0") setView({ x: 0, y: 0, k: 1 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onWheel = (e: WheelEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    setView((v) => {
      const k = Math.min(8, Math.max(0.4, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      const r = k / v.k;
      return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
    });
  };
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-[#0b1f17]/35 backdrop-blur-[6px]" />
        <Dialog.Content className="anim-modal fixed top-1/2 left-1/2 z-50 flex h-[min(92vh,940px)] w-[calc(100vw-16px)] max-w-[1400px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[24px] bg-white shadow-[var(--shadow-lg)] md:flex-row">
          {/* Lateral: categorías y documentos */}
          <aside className="flex max-h-[38%] shrink-0 flex-col border-b border-line/70 bg-surface-2/50 md:max-h-none md:w-[300px] md:border-r md:border-b-0">
            <div className="px-5 pt-5 pb-3">
              <Dialog.Title className="text-[18px] font-semibold tracking-[-0.015em] text-ink">Planos del proyecto</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[12px] text-ink-2">Residencia RC-001 · {blueprints.length} documentos</Dialog.Description>
            </div>
            <div className="flex flex-wrap gap-1.5 px-5 pb-3">
              {(["all", ...Object.keys(BLUEPRINT_CATEGORY_LABEL)] as (Blueprint["category"] | "all")[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn("h-7 rounded-full px-2.5 text-[12px] font-medium transition", category === c ? "bg-brand text-white" : "bg-white text-ink-2 ring-1 ring-line hover:text-ink")}
                >
                  {c === "all" ? "Todos" : BLUEPRINT_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
            <ul className="scroll-thin min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
              {list.map((b) => (
                <li key={b.id}>
                  <button onClick={() => selectDoc(b.id)} className={cn("w-full rounded-[12px] px-3 py-2.5 text-left transition", b.id === doc.id ? "bg-white shadow-[var(--shadow-sm)] ring-1 ring-line" : "hover:bg-white/70")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="tabular text-[12px] font-semibold text-brand">{b.code}</span>
                      <span className="text-[11px] text-ink-3">
                        {b.revision} · {b.format.toUpperCase()}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink">{b.title}</span>
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-3">Sin planos para este filtro.</li>}
            </ul>
          </aside>

          {/* Área de visualización */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-4 py-3">
              <select value={doc.id} onChange={(e) => selectDoc(e.target.value)} className="h-9 max-w-[280px] rounded-full border border-line bg-white px-3 text-[13px] text-ink" aria-label="Documento">
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.title}
                  </option>
                ))}
              </select>
              <div className="flex rounded-full bg-surface-2 p-1" role="radiogroup" aria-label="Nivel">
                {LEVELS.map((l) => (
                  <button key={l} role="radio" aria-checked={level === l} onClick={() => setLevel(l)} className={cn("h-7 rounded-full px-2.5 text-[12px] font-medium transition", level === l ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}>
                    {LEVEL_LABEL[l]}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Tooltip content="Alejar (−)">
                  <button onClick={() => zoom(1 / 1.2)} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Alejar">
                    <Minus size={16} />
                  </button>
                </Tooltip>
                <span className="tabular w-12 text-center text-[12px] text-ink-2">{Math.round(view.k * 100)} %</span>
                <Tooltip content="Acercar (+)">
                  <button onClick={() => zoom(1.2)} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Acercar">
                    <Plus size={16} />
                  </button>
                </Tooltip>
                <Tooltip content="Restablecer vista (0)">
                  <button onClick={() => setView({ x: 0, y: 0, k: 1 })} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Restablecer vista">
                    <RotateCcw size={16} />
                  </button>
                </Tooltip>
                <Tooltip content="Pantalla completa">
                  <button onClick={() => frameRef.current?.requestFullscreen?.().catch(() => {})} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Pantalla completa">
                    <Maximize2 size={16} />
                  </button>
                </Tooltip>
                <Dialog.Close className="ml-1 grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Cerrar visor de planos">
                  <X size={18} />
                </Dialog.Close>
              </div>
            </div>

            <div
              ref={frameRef}
              className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-[#f6f8f7] active:cursor-grabbing"
              style={{ backgroundImage: "radial-gradient(rgb(16 41 31 / 0.08) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
              onWheel={onWheel}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDoubleClick={() => zoom(1.5)}
            >
              <div className="absolute inset-0 grid place-items-center p-6" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "center", transition: dragging ? "none" : "transform 120ms ease-out" }}>
                {doc.format === "pdf" ? (
                  <object data={asset(doc.src)} type="application/pdf" className="h-full w-full rounded-lg bg-white shadow-[var(--shadow-md)]" aria-label={doc.title}>
                    <p className="p-6 text-[13px]">Tu navegador no puede mostrar PDF. <a href={asset(doc.src)}>Descargar</a></p>
                  </object>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset(doc.src)} alt={`${doc.code} · ${doc.title}`} className="blueprint-img max-h-full max-w-full rounded-md bg-white shadow-[var(--shadow-md)]" draggable={false} />
                )}
              </div>
              {doc.illustrative && (
                <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-warning-soft px-3.5 py-1.5 text-[12px] font-medium text-[#7c5314] shadow-[var(--shadow-sm)]">
                  <TriangleAlert size={14} /> Plano ilustrativo de demostración · no apto para ejecución constructiva
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
