"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Box, Car, Check, CheckCircle2, Clock, DoorOpen, Droplets, FlipHorizontal2, Footprints, House, MessageSquarePlus, MousePointerClick, Plane, Send, SlidersHorizontal, Sofa, Sun, Tag, Tent, Waves, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cn, formatDate } from "@/lib/format";
import type { GuestComment, GuestPin } from "@/lib/guest";
import { ProjectModelFrame, type ModelCmd, type ModelPick } from "@/components/viewer/ProjectModelFrame";
import { useGuestComment } from "./GuestComments";

const EXPO = [0.16, 1, 0.3, 1] as const;
/** Pocas vistas, las que un cliente realmente necesita */
const VIEWS: { k: string; l: string; icon: LucideIcon }[] = [
  { k: "iso", l: "General", icon: Box },
  { k: "rFrente", l: "Frente", icon: House },
  { k: "rPost", l: "Atrás", icon: FlipHorizontal2 },
  { k: "rAereaF", l: "Aérea", icon: Plane },
  { k: "rAcceso", l: "Acceso", icon: DoorOpen },
  { k: "sala", l: "Sala", icon: Sofa },
  { k: "terraza", l: "Terraza", icon: Sun },
  { k: "rPisc", l: "Piscina", icon: Waves },
  { k: "rParq", l: "Parqueadero", icon: Car },
  { k: "rBohio", l: "Bohío", icon: Tent },
  { k: "rLago", l: "Lago", icon: Droplets },
];
const STATUS = {
  new: { label: "Recibido", icon: Check, cls: "bg-surface-2 text-ink-2" },
  in_progress: { label: "En curso", icon: Clock, cls: "bg-warning-soft text-[#7c5314]" },
  done: { label: "Hecho", icon: CheckCircle2, cls: "bg-accent-soft text-[#13704a]" },
  dismissed: { label: "Revisado", icon: Check, cls: "bg-surface-2 text-ink-2" },
} as const;

/** Área realmente visible (descuenta el teclado en iPhone): alto y desplazamiento superior. */
function useVisibleArea() {
  const snap = useSyncExternalStore(
    (cb) => {
      const vv = window.visualViewport;
      vv?.addEventListener("resize", cb);
      vv?.addEventListener("scroll", cb);
      return () => {
        vv?.removeEventListener("resize", cb);
        vv?.removeEventListener("scroll", cb);
      };
    },
    () => {
      const vv = window.visualViewport;
      return vv ? `${Math.round(vv.height)}|${Math.round(vv.offsetTop)}` : `${window.innerHeight}|0`;
    },
    () => "0|0",
  );
  const [h, top] = snap.split("|").map(Number);
  return { h, top };
}

/**
 * Visor del modelo 3D para invitados: limpio, con pocas vistas y comentarios anclados a un punto,
 * como en Figma (tocas el lugar, escribes y queda un alfiler numerado).
 */
export function GuestViewer({ path, settings, load, onClose }: { path: string; settings: Record<string, string>; load: (p: string) => Promise<string>; onClose: () => void }) {
  const { enabled, items, name: savedName, post } = useGuestComment();
  const [view, setView] = useState("iso");
  const [commentMode, setCommentMode] = useState(false);
  const [labels, setLabels] = useState(false);
  const [cmd, setCmd] = useState<ModelCmd | null>(null);
  const [pick, setPick] = useState<ModelPick | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);

  // Alfileres de los comentarios que ya hizo este cliente (de más antiguo a más nuevo)
  const pinned = useMemo(() => [...items].filter((c) => c.pin).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [items]);
  const pins = useMemo(() => pinned.map((c, i) => ({ id: c.id, n: i + 1, p: (c.pin as GuestPin).p, status: c.status, active: c.id === active })), [pinned, active]);
  const activeComment = pinned.find((c) => c.id === active) ?? null;
  const send = (type: ModelCmd["type"], arg?: unknown) => setCmd((c) => ({ n: (c?.n ?? 0) + 1, type, arg }));
  const area = useVisibleArea();
  const [menu, setMenu] = useState(false);
  const [hint, setHint] = useState(true);

  // La página de atrás queda congelada: el iPhone no la desplaza ni la amplía al abrir el teclado
  useEffect(() => {
    const y = window.scrollY;
    const b = document.body;
    const prev = { position: b.style.position, top: b.style.top, width: b.style.width };
    b.style.position = "fixed";
    b.style.top = `-${y}px`;
    b.style.width = "100%";
    return () => {
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.width = prev.width;
      window.scrollTo(0, y);
    };
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 5200);
    return () => window.clearTimeout(t);
  }, []);
  const goView = (k: string) => {
    setView(k);
    setMenu(false);
    setPick(null);
    send("view", k);
  };
  const closePopup = () => {
    setPick(null);
    setActive(null);
    setError(null);
  };
  const submit = async () => {
    if (!pick || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await post({
        author: name.trim(),
        body: text,
        ref: { type: "modelo", label: VIEWS.find((v) => v.k === view)?.l ?? "Modelo 3D" },
        pin: { p: pick.p, cam: pick.cam, tgt: pick.tgt, fov: pick.fov },
      });
      setText("");
      setPick(null);
      setCommentMode(false);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <motion.div className="fixed inset-0 z-[60] bg-[#0b1712]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <ProjectModelFrame
        path={path}
        settings={settings}
        interactive
        compact={false}
        onActivate={() => {}}
        load={load}
        dark
        guest
        commentMode={commentMode}
        pins={pins}
        showLabels={labels}
        cmd={cmd}
        onPick={(p) => {
          setActive(null);
          setPick(p);
        }}
        onWalk={setWalking}
        onPinClick={(id) => {
          setPick(null);
          setActive((a) => (a === id ? null : id));
        }}
      />

      {/* Barra superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
        <button onClick={onClose} className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-[14px] font-semibold text-ink shadow-[var(--shadow-md)] transition active:scale-[0.97]">
          <X size={16} /> Cerrar
        </button>
      </div>

      {/* Aviso del modo comentar */}
      <AnimatePresence>
        {commentMode && !pick && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease: EXPO }} className="pointer-events-none absolute top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1f5fd1] px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[var(--shadow-lg)]">
            <MousePointerClick size={15} /> Toca el lugar que quieres comentar
          </motion.div>
        )}
      </AnimatePresence>

      {/* Abajo: dos acciones principales y un solo botón que abre todas las opciones (como en MallPlay) */}
      {!walking && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/95 p-1.5 shadow-[0_12px_34px_rgb(0_0_0/0.3)] backdrop-blur-md">
              {enabled && (
                <button onClick={() => (setCommentMode((v) => !v), setPick(null), setActive(null), setMenu(false))} aria-pressed={commentMode} className={cn("inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold transition active:scale-[0.97]", commentMode ? "bg-[#1f5fd1] text-white" : "bg-[#0f2a20] text-white")}>
                  <MessageSquarePlus size={18} /> {commentMode ? "Cancelar" : "Comentar"}
                </button>
              )}
              <button
                onClick={() => {
                  setCommentMode(false);
                  setPick(null);
                  setActive(null);
                  setMenu(false);
                  send("walk");
                }}
                className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold text-ink transition hover:bg-surface-2 active:scale-[0.97]"
              >
                <Footprints size={18} /> Recorrido
              </button>
            </div>
          </div>

          <button onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Vistas y opciones" className={cn("pointer-events-auto absolute right-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-20 grid h-14 w-14 place-items-center rounded-full shadow-[0_12px_30px_rgb(0_0_0/0.3)] transition active:scale-[0.94] sm:right-4 sm:bottom-24", menu ? "bg-[#0f2a20] text-white" : "bg-white/95 text-ink")}>
            <motion.span animate={{ rotate: menu ? 90 : 0 }} transition={{ duration: 0.35, ease: EXPO }}>
              {menu ? <X size={22} /> : <SlidersHorizontal size={22} />}
            </motion.span>
          </button>

          <AnimatePresence>
            {menu && (
              <>
                <motion.div className="absolute inset-0 z-10" onPointerDown={() => setMenu(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 8 }}
                  transition={{ duration: 0.4, ease: EXPO }}
                  style={{ transformOrigin: "bottom right", maxHeight: "calc(100% - 9rem)" }}
                  className="absolute right-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+9.75rem)] z-20 w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] bg-[#fbf9f4] p-4 shadow-[0_24px_70px_rgb(0_0_0/0.4)] sm:right-4 sm:bottom-[11.5rem]"
                >
                  <p className="px-1 text-[11px] font-bold tracking-[0.16em] text-[#6f6a60] uppercase">Zonas de la casa</p>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {VIEWS.map((v) => (
                      <button key={v.k} onClick={() => goView(v.k)} aria-pressed={view === v.k} className={cn("flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-[18px] px-1.5 py-3 text-center text-[12.5px] leading-tight font-medium transition active:scale-[0.96]", view === v.k ? "bg-[#0f2a20] text-white" : "bg-[#eeebe3] text-ink hover:bg-[#e6e2d8]")}>
                        <v.icon size={22} strokeWidth={1.6} />
                        {v.l}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 px-1 text-[11px] font-bold tracking-[0.16em] text-[#6f6a60] uppercase">Mostrar</p>
                  <div className="mt-2.5">
                    <button onClick={() => setLabels((v) => !v)} aria-pressed={labels} className={cn("flex min-h-[56px] w-full items-center gap-3 rounded-[18px] px-4 text-left text-[14px] font-medium transition active:scale-[0.98]", labels ? "bg-[#0f2a20] text-white" : "bg-[#eeebe3] text-ink")}>
                      <Tag size={20} strokeWidth={1.6} />
                      <span className="flex-1">Nombres de los espacios</span>
                      <span className={cn("grid h-5 w-5 place-items-center rounded-full", labels ? "bg-[#2ea06e]" : "ring-1 ring-black/20")}>{labels && <Check size={12} strokeWidth={3} />}</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Pista de gestos al abrir */}
      <AnimatePresence>
        {hint && !walking && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EXPO }} className="pointer-events-none absolute bottom-[max(6rem,calc(env(safe-area-inset-bottom)+6rem))] left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-[12px] font-medium whitespace-nowrap text-white backdrop-blur-md">
            Arrastra para girar · Pellizca para acercar
          </motion.p>
        )}
      </AnimatePresence>

      {/* Nota nueva anclada al punto elegido (dentro del área visible, encima del teclado) */}
      <div className="pointer-events-none fixed left-0 z-10 w-full" style={{ top: area.top, height: area.h || "100%" }}>
      <AnimatePresence>
        {pick && (
          <Popup key="new" at={{ x: pick.sx, y: pick.sy }} onClose={closePopup}>
            <p className="text-[12px] font-semibold tracking-wide text-[#1f5fd1] uppercase">Nuevo comentario</p>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Tu nombre" className="mt-2 h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[16px] text-ink outline-none focus:border-accent" />
            <textarea autoFocus={typeof window !== "undefined" && window.innerWidth >= 640} onFocus={() => window.scrollTo(0, 0)} enterKeyHint="send" value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={3} placeholder="¿Qué te gustaría cambiar aquí?" className="mt-2 w-full resize-none rounded-[10px] border border-line bg-white p-3 text-[16px] leading-relaxed text-ink outline-none focus:border-accent" />
            {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={closePopup} className="h-10 rounded-full bg-surface-2 px-4 text-[13px] font-medium text-ink-2">
                Cancelar
              </button>
              <button onClick={() => void submit()} disabled={busy || !text.trim()} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand text-[13px] font-semibold text-white disabled:opacity-45">
                <Send size={14} /> {busy ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </Popup>
        )}
        {activeComment && !pick && (
          <Popup key={activeComment.id} at={null} onClose={closePopup}>
            <Existing c={activeComment} n={pinned.findIndex((x) => x.id === activeComment.id) + 1} />
          </Popup>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Tarjeta flotante: junto al punto elegido en pantallas grandes; hoja inferior en celular. */
function Popup({ at, onClose, children }: { at: { x: number; y: number } | null; onClose: () => void; children: React.ReactNode }) {
  const w = typeof window === "undefined" ? 1024 : window.innerWidth;
  const h = typeof window === "undefined" ? 768 : window.innerHeight;
  const desktop = w >= 640;
  const style = desktop && at ? { left: Math.min(Math.max(12, at.x + 18), w - 332), top: Math.min(Math.max(12, at.y - 40), h - 360) } : desktop ? { right: 16, top: 80 } : undefined;
  return (
    <motion.div
      initial={{ opacity: 0, y: desktop ? 8 : 40, scale: desktop ? 0.96 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: desktop ? 8 : 40 }}
      transition={{ duration: 0.4, ease: EXPO }}
      className={cn("pointer-events-auto absolute z-10 w-[320px] rounded-[20px] bg-white p-4 shadow-[0_20px_60px_rgb(0_0_0/0.4)]", !desktop && "inset-x-3 top-3 w-auto")}
      style={style}
    >
      <button onClick={onClose} className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2" aria-label="Cerrar">
        <X size={16} />
      </button>
      {children}
    </motion.div>
  );
}

function Existing({ c, n }: { c: GuestComment; n: number }) {
  const st = STATUS[c.status];
  return (
    <div>
      <div className="flex items-center gap-2 pr-8">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#d9541e] text-[12px] font-bold text-white">{n}</span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)}>
          <st.icon size={12} /> {st.label}
        </span>
        <span className="text-[11px] text-ink-3">{formatDate(c.createdAt.slice(0, 10))}</span>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{c.body}</p>
      {c.reply && (
        <p className="mt-2 rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-2">
          <span className="font-semibold text-brand">Equipo RC: </span>
          {c.reply}
        </p>
      )}
    </div>
  );
}
