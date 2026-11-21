"use client";

import { Loader2, Minus, Plus, RotateCcw, Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { loadPdfJs } from "@/lib/docs";
import { cn } from "@/lib/format";

type View = { x: number; y: number; k: number };
const MIN = 0.3;
const MAX = 10;
const clampK = (k: number) => Math.min(MAX, Math.max(MIN, k));

/**
 * Lienzo de plano con zoom (rueda, pellizco, doble clic, teclado) y desplazamiento.
 * Imágenes: se muestran tal cual. PDF: cada página se dibuja con pdf.js en alta resolución
 * (funciona igual en móvil, donde el visor nativo de PDF no permite zoom fino).
 */
export function PlanStage({ url, format, title, className, dark = false }: { url: string | null; format: string; title: string; className?: string; dark?: boolean }) {
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [animate, setAnimate] = useState(true);
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; k: number } | null>(null);

  // Al cambiar de documento se reinicia la vista
  const [prevUrl, setPrevUrl] = useState(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    setView({ x: 0, y: 0, k: 1 });
  }

  const zoomAt = useCallback((factor: number, cx = 0, cy = 0) => {
    setView((v) => {
      const k = clampK(v.k * factor);
      const r = k / v.k;
      return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
    });
  }, []);
  const reset = () => {
    setAnimate(true);
    setView({ x: 0, y: 0, k: 1 });
  };

  // Rueda: listener nativo no pasivo para impedir el desplazamiento de la página
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setAnimate(false);
      const intensity = e.ctrlKey ? 0.012 : 0.0022; // trackpad (pellizco) vs. rueda
      zoomAt(Math.exp(-e.deltaY * intensity), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "0") return reset();
      const f = e.key === "+" || e.key === "=" ? 1.25 : e.key === "-" ? 0.8 : 0;
      if (!f) return;
      setAnimate(true);
      zoomAt(f);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomAt]);

  const onDown = (e: RPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimate(false);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
    }
  };
  const onMove = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = frame.current!.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - r.left - r.width / 2;
      const cy = (a.y + b.y) / 2 - r.top - r.height / 2;
      const target = clampK((pinch.current.k * d) / pinch.current.d);
      setView((v) => {
        const ratio = target / v.k;
        return { k: target, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
      });
      return;
    }
    setView((v) => ({ ...v, x: v.x + next.x - prev.x, y: v.y + next.y - prev.y }));
  };
  const onUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onDouble = (e: React.MouseEvent) => {
    const r = frame.current!.getBoundingClientRect();
    setAnimate(true);
    if (view.k > 2.5) reset();
    else zoomAt(2, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
  };

  return (
    <div
      ref={frame}
      className={cn("relative h-full w-full cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing", dark ? "bg-[#0e1a15]" : "bg-[#f4f7f5]", className)}
      style={{ backgroundImage: `radial-gradient(${dark ? "rgb(255 255 255 / 0.06)" : "rgb(16 41 31 / 0.08)"} 1px, transparent 1px)`, backgroundSize: "18px 18px" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={onDouble}
    >
      <div
        className="absolute inset-0 grid place-items-center p-6 sm:p-10"
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`, transformOrigin: "center", transition: animate ? "transform 380ms cubic-bezier(0.16, 1, 0.3, 1)" : "none", willChange: "transform" }}
        onTransitionEnd={() => setAnimate(false)}
      >
        {!url ? (
          <Loader2 className="animate-spin text-ink-3" size={22} />
        ) : format === "pdf" ? (
          <PdfPages key={url} url={url} title={title} zoom={view.k} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} draggable={false} className="anim-content max-h-full max-w-full rounded-md bg-white shadow-[0_8px_40px_rgb(16_41_31/0.18)]" />
        )}
      </div>

      <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-full bg-white/92 p-1 shadow-[var(--shadow-md)] ring-1 ring-black/5" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <StageBtn label="Alejar" onClick={() => (setAnimate(true), zoomAt(0.8))}>
          <Minus size={15} />
        </StageBtn>
        <span className="tabular w-11 text-center text-[12px] font-medium text-ink-2">{Math.round(view.k * 100)}%</span>
        <StageBtn label="Acercar" onClick={() => (setAnimate(true), zoomAt(1.25))}>
          <Plus size={15} />
        </StageBtn>
        <StageBtn label="Ajustar a la pantalla" onClick={reset}>
          <RotateCcw size={14} />
        </StageBtn>
        <StageBtn label="Pantalla completa" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : frame.current?.requestFullscreen?.())?.catch?.(() => {})}>
          <Maximize2 size={14} />
        </StageBtn>
      </div>
    </div>
  );
}

function StageBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink">
      {children}
    </button>
  );
}

/** Páginas de un PDF dibujadas en canvas; se vuelven a dibujar más nítidas al acercar. */
function PdfPages({ url, title, zoom }: { url: string; title: string; zoom: number }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; doc?: import("pdfjs-dist").PDFDocumentProxy; error?: string }>({ status: "loading" });
  const [quality, setQuality] = useState(1);

  // Nitidez según el zoom (con espera para no redibujar en cada paso)
  useEffect(() => {
    const target = zoom > 3 ? 3 : zoom > 1.6 ? 2 : 1;
    const t = window.setTimeout(() => setQuality(target), 260);
    return () => window.clearTimeout(t);
  }, [zoom]);

  // Se monta con key={url}: cada documento nuevo empieza en "loading"
  useEffect(() => {
    let alive = true;
    let doc: import("pdfjs-dist").PDFDocumentProxy | null = null;
    (async () => {
      try {
        const lib = await loadPdfJs();
        doc = await lib.getDocument({ url }).promise;
        if (alive) setState({ status: "ready", doc });
        else void doc.destroy();
      } catch (e) {
        if (alive) setState({ status: "error", error: (e as Error).message });
      }
    })();
    return () => {
      alive = false;
      void doc?.destroy();
    };
  }, [url]);

  if (state.status === "error")
    return (
      <p className="max-w-sm rounded-xl bg-white p-5 text-center text-[13px] text-ink-2 shadow-[var(--shadow-md)]">
        No se pudo mostrar el PDF. <a className="font-medium text-brand underline" href={url} target="_blank" rel="noreferrer">Abrir en otra pestaña</a>
      </p>
    );
  if (state.status === "loading" || !state.doc) return <Loader2 className="animate-spin text-ink-3" size={22} />;
  const pages = state.doc.numPages;
  return (
    <div className={cn("flex w-full max-w-full flex-col items-center gap-6", pages === 1 ? "h-full min-h-0 justify-center" : "self-start")} aria-label={title}>
      {Array.from({ length: pages }, (_, i) => (
        <PdfPage key={i} doc={state.doc!} index={i + 1} quality={quality} single={pages === 1} />
      ))}
    </div>
  );
}

function PdfPage({ doc, index, quality, single }: { doc: import("pdfjs-dist").PDFDocumentProxy; index: number; quality: number; single: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let alive = true;
    (async () => {
      const page = await doc.getPage(index);
      if (!alive || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.width / base.height);
      // Lado mayor ~ 2200 px × calidad (tope 8000 px por límites de canvas en móviles)
      const longSide = Math.min(8000, 2200 * quality * Math.min(2, window.devicePixelRatio || 1) / 1.4);
      const scale = longSide / Math.max(base.width, base.height);
      const vp = page.getViewport({ scale });
      const c = canvas.current;
      const off = document.createElement("canvas");
      off.width = Math.round(vp.width);
      off.height = Math.round(vp.height);
      const ctx = off.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, off.width, off.height);
      task = page.render({ canvasContext: ctx, viewport: vp, canvas: off } as Parameters<typeof page.render>[0]);
      await task.promise;
      if (!alive) return;
      c.width = off.width;
      c.height = off.height;
      c.getContext("2d")!.drawImage(off, 0, 0);
    })().catch(() => {});
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [doc, index, quality]);

  return (
    <canvas
      ref={canvas}
      className="anim-content block rounded-md bg-white shadow-[0_8px_40px_rgb(16_41_31/0.18)]"
      style={single ? { maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", opacity: ratio ? 1 : 0 } : { width: "100%", height: "auto", aspectRatio: ratio ?? 0.7 }}
    />
  );
}
