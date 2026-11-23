"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Box, Camera, CheckCircle2, Clock, Inbox, Layers3, MapPin, MessageSquare, Send, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useComments, type ClientComment, type CommentRef, type CommentStatus } from "@/stores/commentsStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUI } from "@/stores/uiStore";
import { cn, formatDate } from "@/lib/format";
import { ConfirmDelete, inputCls } from "./shared";

const EXPO = [0.16, 1, 0.3, 1] as const;
const REF_ICON: Record<CommentRef, ReactNode> = { general: <MessageSquare size={14} />, modelo: <Box size={14} />, foto: <Camera size={14} />, plano: <Layers3 size={14} />, avance: <TrendingUp size={14} /> };
const REF_LABEL: Record<CommentRef, string> = { general: "General", modelo: "Modelo 3D", foto: "Foto de obra", plano: "Plano", avance: "Avance" };
const STATUS: Record<CommentStatus, { label: string; fg: string; bg: string }> = {
  new: { label: "Nuevo", fg: "#b3352b", bg: "#fbe3e0" },
  in_progress: { label: "En curso", fg: "#7c5314", bg: "#fbefd5" },
  done: { label: "Hecho", fg: "#13704a", bg: "#dff3e9" },
  dismissed: { label: "Descartado", fg: "#5b6b64", bg: "#eef2f0" },
};
const FILTERS: { key: "open" | "done" | "all"; label: string }[] = [
  { key: "open", label: "Por atender" },
  { key: "done", label: "Resueltos" },
  { key: "all", label: "Todos" },
];

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  if (m < 60 * 24) return `hace ${Math.round(m / 60)} h`;
  return formatDate(iso.slice(0, 10));
};

/** Bandeja de comentarios de los clientes: avisos nuevos, estado del cambio y respuesta al cliente. */
export function CommentsTab() {
  const items = useComments((s) => s.items);
  const state = useComments((s) => s.state);
  const load = useComments((s) => s.load);
  const markSeen = useComments((s) => s.markSeen);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");

  useEffect(() => {
    void load();
  }, [load]);

  // Al abrir la bandeja, lo que se ve queda como "leído"
  useEffect(() => {
    const unseen = items.filter((c) => !c.seenAt).map((c) => c.id);
    if (unseen.length) void markSeen(unseen);
  }, [items, markSeen]);

  const visible = useMemo(() => items.filter((c) => (filter === "all" ? true : filter === "open" ? c.status === "new" || c.status === "in_progress" : c.status === "done" || c.status === "dismissed")), [items, filter]);
  const counts = { open: items.filter((c) => c.status === "new" || c.status === "in_progress").length, done: items.filter((c) => c.status === "done" || c.status === "dismissed").length, all: items.length };

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[860px] px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Filtro">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} className={cn("h-8 rounded-full px-3.5 text-[13px] font-medium transition", filter === f.key ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}>
                {f.label} <span className="tabular text-ink-3">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <p className="ml-auto text-[12px] text-ink-3">Lo que respondas lo ve el cliente en su enlace.</p>
        </div>

        {state === "error" && !items.length ? (
          <p className="py-16 text-center text-[13px] text-ink-2">No se pudieron cargar los comentarios.</p>
        ) : !visible.length ? (
          <div className="anim-content py-16 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-accent-soft text-brand">
              <Inbox size={28} strokeWidth={1.5} />
            </span>
            <h3 className="mt-4 text-[18px] font-semibold text-ink">{filter === "open" ? "No hay comentarios pendientes" : "Nada por aquí"}</h3>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-2">Cuando un cliente comente desde su enlace, te llegará un aviso aquí y en la campana.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {visible.map((c) => (
                <Card key={c.id} c={c} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function Card({ c }: { c: ClientComment }) {
  const setStatus = useComments((s) => s.setStatus);
  const sendReply = useComments((s) => s.sendReply);
  const remove = useComments((s) => s.remove);
  const openBlueprints = useUI((s) => s.openBlueprints);
  const focusModel = useUI((s) => s.focusModel);
  const hasModel = useProjectStore((s) => !!s.projects.find((p) => p.id === s.projectId)?.modelPath);
  const num = useComments((s) => [...s.items].filter((x) => x.pin).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).findIndex((x) => x.id === c.id) + 1);
  const photoRef = c.refType;
  const hasPlano = useProjectStore((s) => (c.refId ? s.blueprints.some((b) => b.id === c.refId) : false));
  const [reply, setReply] = useState(c.reply);
  const [busy, setBusy] = useState(false);
  const st = STATUS[c.status];
  const isNew = c.status === "new";

  return (
    <motion.li layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.45, ease: EXPO }} className={cn("rounded-[20px] bg-white p-4 ring-1 sm:p-5", isNew ? "ring-[#e5484d]/40" : "ring-line")}>
      <div className="flex flex-wrap items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink">{c.author.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">
            {c.author} <span className="ml-1 text-[12px] font-normal text-ink-3">{ago(c.createdAt)}</span>
          </p>
          <p className="mt-0.5 inline-flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5">
              {REF_ICON[photoRef]} {REF_LABEL[photoRef]}
            </span>
            {c.refLabel && <span className="truncate">{c.refLabel}</span>}
            {c.pin && hasModel && (
              <button onClick={() => focusModel(c.pin!, num)} className="inline-flex items-center gap-1 rounded-full bg-[#1f5fd1] px-2.5 py-0.5 text-[12px] font-semibold text-white transition hover:brightness-110">
                <MapPin size={12} /> Ver en el modelo
              </button>
            )}
            {hasPlano && (
              <button onClick={() => openBlueprints(c.refId)} className="font-medium text-brand underline">
                Ver plano
              </button>
            )}
          </p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: st.fg, backgroundColor: st.bg }}>
          {st.label}
        </span>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{c.body}</p>

      <div className="mt-3 flex gap-2">
        <input value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} placeholder="Respuesta para el cliente (opcional)" className={cn(inputCls, "h-9 flex-1 text-[13px]")} onKeyDown={(e) => e.key === "Enter" && reply.trim() !== c.reply && void sendReply(c.id, reply.trim())} />
        <button
          disabled={busy || reply.trim() === c.reply}
          onClick={async () => {
            setBusy(true);
            await sendReply(c.id, reply.trim());
            setBusy(false);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition hover:bg-surface-3 disabled:opacity-40"
        >
          <Send size={13} /> Responder
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {c.status !== "in_progress" && c.status !== "done" && (
          <Action onClick={() => void setStatus(c.id, "in_progress")} icon={<Clock size={14} />} label="Lo estoy haciendo" />
        )}
        {c.status !== "done" && <Action primary onClick={() => void setStatus(c.id, "done")} icon={<CheckCircle2 size={14} />} label="Hecho" />}
        {c.status !== "dismissed" && c.status !== "done" && <Action onClick={() => void setStatus(c.id, "dismissed")} icon={<X size={14} />} label="Descartar" />}
        {(c.status === "done" || c.status === "dismissed") && <Action onClick={() => void setStatus(c.id, "new")} icon={<Inbox size={14} />} label="Reabrir" />}
        <span className="ml-auto">
          <ConfirmDelete size="sm" onConfirm={() => void remove(c.id)} />
        </span>
      </div>
    </motion.li>
  );
}

function Action({ onClick, icon, label, primary }: { onClick: () => void; icon: ReactNode; label: string; primary?: boolean }) {
  return (
    <button onClick={onClick} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition active:scale-[0.97]", primary ? "bg-brand text-white hover:brightness-110" : "bg-surface-2 text-ink-2 hover:text-ink")}>
      {icon} {label}
    </button>
  );
}
