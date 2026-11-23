"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, Clock, Footprints, MessageSquarePlus, MousePointerClick, Send, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn, formatDate } from "@/lib/format";
import type { GuestComment, GuestPin } from "@/lib/guest";
import { ProjectModelFrame, type ModelCmd, type ModelPick } from "@/components/viewer/ProjectModelFrame";
import { useGuestComment } from "./GuestComments";

const EXPO = [0.16, 1, 0.3, 1] as const;
/** Pocas vistas, las que un cliente realmente necesita */
const VIEWS: { k: string; l: string }[] = [
  { k: "iso", l: "General" },
  { k: "rFrente", l: "Frente" },
  { k: "rPost", l: "Atrás" },
  { k: "rAereaF", l: "Aérea" },
  { k: "rAcceso", l: "Acceso" },
  { k: "sala", l: "Sala" },
  { k: "terraza", l: "Terraza" },
  { k: "rPisc", l: "Piscina" },
  { k: "rParq", l: "Parqueadero" },
  { k: "rBohio", l: "Bohío" },
  { k: "rLago", l: "Lago" },
];
const STATUS = {
  new: { label: "Recibido", icon: Check, cls: "bg-surface-2 text-ink-2" },
  in_progress: { label: "En curso", icon: Clock, cls: "bg-warning-soft text-[#7c5314]" },
  done: { label: "Hecho", icon: CheckCircle2, cls: "bg-accent-soft text-[#13704a]" },
  dismissed: { label: "Revisado", icon: Check, cls: "bg-surface-2 text-ink-2" },
} as const;

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

  const goView = (k: string) => {
    setView(k);
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
        <button onClick={() => setLabels((v) => !v)} aria-pressed={labels} className={cn("pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13px] font-medium shadow-[var(--shadow-md)] transition active:scale-[0.97]", labels ? "bg-ink text-white" : "bg-white/95 text-ink", walking && "invisible")}>
          <Tag size={15} /> Nombres
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

      {/* Barra inferior: vistas + recorrido + comentar. Durante el recorrido la oculta: el recorrido trae su propia tarjeta */}
      {!walking && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <div className="scroll-thin pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto rounded-full bg-[#0f2a20]/92 p-1.5 shadow-[0_10px_30px_rgb(0_0_0/0.35)] backdrop-blur-md" role="tablist" aria-label="Vistas">
            {VIEWS.map((v) => (
              <button key={v.k} role="tab" aria-selected={view === v.k} onClick={() => goView(v.k)} className={cn("h-10 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition active:scale-[0.96]", view === v.k ? "bg-white text-[#0f2a20]" : "text-white/75 hover:text-white")}>
                {v.l}
              </button>
            ))}
          </div>
          <div className="pointer-events-auto flex gap-2">
            <button
              onClick={() => {
                setCommentMode(false);
                setPick(null);
                setActive(null);
                send("walk");
              }}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white/95 px-5 text-[14px] font-semibold text-ink shadow-[var(--shadow-md)] transition active:scale-[0.97]"
            >
              <Footprints size={17} /> Recorrido
            </button>
            {enabled && (
              <button onClick={() => (setCommentMode((v) => !v), setPick(null), setActive(null))} aria-pressed={commentMode} className={cn("inline-flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-semibold shadow-[var(--shadow-md)] transition active:scale-[0.97]", commentMode ? "bg-[#1f5fd1] text-white" : "bg-[#d9541e] text-white")}>
                <MessageSquarePlus size={17} /> {commentMode ? "Cancelar" : "Comentar"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nota nueva anclada al punto elegido */}
      <AnimatePresence>
        {pick && (
          <Popup key="new" at={{ x: pick.sx, y: pick.sy }} onClose={closePopup}>
            <p className="text-[12px] font-semibold tracking-wide text-[#1f5fd1] uppercase">Nuevo comentario</p>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Tu nombre" className="mt-2 h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[16px] text-ink outline-none focus:border-accent" />
            <textarea autoFocus={typeof window !== "undefined" && window.innerWidth >= 640} value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={3} placeholder="¿Qué te gustaría cambiar aquí?" className="mt-2 w-full resize-none rounded-[10px] border border-line bg-white p-3 text-[16px] leading-relaxed text-ink outline-none focus:border-accent" />
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
      className={cn("pointer-events-auto absolute z-10 w-[320px] rounded-[20px] bg-white p-4 shadow-[0_20px_60px_rgb(0_0_0/0.4)]", !desktop && "inset-x-3 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] w-auto")}
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
