"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, Clock, MessageSquarePlus, Send, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn, formatDate } from "@/lib/format";
import { fetchGuestComments, sendGuestComment, type GuestComment, type GuestPin, type GuestRef } from "@/lib/guest";

const EXPO = [0.16, 1, 0.3, 1] as const;
const KINDS: { type: GuestRef["type"]; label: string }[] = [
  { type: "general", label: "General" },
  { type: "modelo", label: "Modelo 3D" },
  { type: "foto", label: "Fotos" },
  { type: "plano", label: "Planos" },
  { type: "avance", label: "Avance" },
];
const STATUS = {
  new: { label: "Recibido", icon: Check, cls: "bg-surface-2 text-ink-2" },
  in_progress: { label: "En curso", icon: Clock, cls: "bg-warning-soft text-[#7c5314]" },
  done: { label: "Hecho", icon: CheckCircle2, cls: "bg-accent-soft text-[#13704a]" },
  dismissed: { label: "Revisado", icon: Check, cls: "bg-surface-2 text-ink-2" },
} as const;
const NAME_KEY = "rc-guest-name";

type Ctx = {
  enabled: boolean;
  open: (ref?: GuestRef) => void;
  items: GuestComment[];
  /** Nombre recordado del cliente */
  name: string;
  /** Envía un comentario (con punto del modelo opcional) y actualiza la lista */
  post: (input: { author: string; body: string; ref: GuestRef; pin?: GuestPin | null }) => Promise<void>;
};
const GuestCommentCtx = createContext<Ctx>({ enabled: false, open: () => {}, items: [], name: "", post: async () => {} });
/** Abre el cuadro de comentarios (opcionalmente ligado a una foto, plano o al modelo). */
export const useGuestComment = () => useContext(GuestCommentCtx);

/** Comentarios del cliente: botón flotante, formulario y seguimiento de sus pedidos. */
export function GuestCommentsProvider({ client, token, children }: { client: SupabaseClient; token: string; children: ReactNode }) {
  const [allow, setAllow] = useState(false);
  const [items, setItems] = useState<GuestComment[]>([]);
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState<GuestRef>({ type: "general" });
  const [name, setName] = useState(() => {
    try {
      return typeof localStorage === "undefined" ? "" : (localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      return "";
    }
  });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchGuestComments(client, token);
      setAllow(r.allow);
      setItems(r.items);
    } catch {
      /* sin comentarios: la página sigue funcionando */
    }
  }, [client, token]);

  useEffect(() => {
    let alive = true;
    fetchGuestComments(client, token)
      .then((r) => {
        if (!alive) return;
        setAllow(r.allow);
        setItems(r.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [client, token]);

  const post = useCallback(
    async (input: { author: string; body: string; ref: GuestRef; pin?: GuestPin | null }) => {
      await sendGuestComment(client, token, input);
      try {
        localStorage.setItem(NAME_KEY, input.author.trim());
      } catch {}
      setName(input.author.trim());
      await refresh();
    },
    [client, token, refresh],
  );

  const api = useMemo<Ctx>(
    () => ({
      enabled: allow,
      items,
      name,
      post,
      open: (r) => {
        setRef(r ?? { type: "general" });
        setSent(false);
        setError(null);
        setOpen(true);
      },
    }),
    [allow, items, name, post],
  );

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendGuestComment(client, token, { author: name.trim(), body: text, ref });
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {}
      setText("");
      setSent(true);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <GuestCommentCtx.Provider value={api}>
      {children}
      {allow && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.7, ease: EXPO }}
          onClick={() => api.open()}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 inline-flex h-14 items-center gap-2.5 rounded-full bg-[#0f2a20] pr-5 pl-4 text-[15px] font-semibold text-white shadow-[0_10px_30px_rgb(0_0_0/0.25)] transition hover:scale-[1.03] active:scale-[0.97] sm:right-6 sm:bottom-6"
        >
          <MessageSquarePlus size={20} />
          Comentar
          {items.some((c) => c.status === "done" && c.reply) && <span className="h-2.5 w-2.5 rounded-full bg-[#2ea06e] ring-2 ring-[#0f2a20]" />}
        </motion.button>
      )}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-overlay fixed inset-0 z-[90] bg-[#0b1f17]/55" />
          <Dialog.Content onOpenAutoFocus={(e) => e.preventDefault()} className="fixed inset-x-0 bottom-0 z-[90] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[26px] bg-white shadow-[var(--shadow-lg)] outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[560px] sm:max-w-[calc(100vw-24px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[26px]" aria-describedby={undefined}>
            <div className="flex items-start gap-3 px-5 pt-5 pb-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-[20px] font-semibold tracking-[-0.02em] text-ink">¿Qué te gustaría cambiar?</Dialog.Title>
                <p className="mt-0.5 text-[13px] text-ink-2">Escríbenos y el equipo lo revisa. Verás aquí el estado de cada pedido.</p>
              </div>
              <Dialog.Close className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label="Cerrar">
                <X size={18} />
              </Dialog.Close>
            </div>

            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
              <p className="mb-1.5 text-[12px] font-medium text-ink-2">Sobre</p>
              <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {KINDS.map((k) => (
                  <button key={k.type} onClick={() => setRef({ type: k.type })} aria-pressed={ref.type === k.type} className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition", ref.type === k.type ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:text-ink")}>
                    {k.label}
                  </button>
                ))}
              </div>
              {ref.label && (
                <p className="mt-2 flex items-center gap-2 rounded-[12px] bg-accent-soft px-3 py-2 text-[12px] text-[#13704a]">
                  <span className="min-w-0 flex-1 truncate">Sobre: {ref.label}</span>
                  <button onClick={() => setRef({ type: ref.type })} className="shrink-0 underline">
                    Quitar
                  </button>
                </p>
              )}

              <label className="mt-4 block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Tu nombre</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej. Carlos" className="h-11 w-full rounded-[12px] border border-line bg-white px-3 text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" />
              </label>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Tu comentario</span>
                <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={4} placeholder="Ej. ¿Podemos cambiar el color de la puerta a uno más claro?" className="w-full resize-none rounded-[12px] border border-line bg-white p-3 text-[15px] leading-relaxed text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" />
              </label>
              {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
              <button onClick={() => void submit()} disabled={busy || !text.trim()} className={cn("mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold text-white transition disabled:opacity-45", sent ? "bg-[#2ea06e]" : "bg-brand hover:brightness-110")}>
                {sent ? <Check size={18} /> : <Send size={16} />} {busy ? "Enviando…" : sent ? "Enviado. ¡Gracias!" : "Enviar al equipo"}
              </button>

              {items.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Tus comentarios</h3>
                  <ul className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {items.map((c) => {
                        const st = STATUS[c.status];
                        return (
                          <motion.li key={c.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EXPO }} className="rounded-[16px] bg-surface-2/70 p-3.5">
                            <div className="flex items-center gap-2">
                              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)}>
                                <st.icon size={12} /> {st.label}
                              </span>
                              <span className="truncate text-[12px] text-ink-3">{c.refLabel || KINDS.find((k) => k.type === c.refType)?.label} · {formatDate(c.createdAt.slice(0, 10))}</span>
                            </div>
                            <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{c.body}</p>
                            {c.reply && (
                              <p className="mt-2 rounded-[10px] bg-white px-3 py-2 text-[13px] leading-relaxed text-ink-2 ring-1 ring-line">
                                <span className="font-semibold text-brand">Equipo RC: </span>
                                {c.reply}
                              </p>
                            )}
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </GuestCommentCtx.Provider>
  );
}
