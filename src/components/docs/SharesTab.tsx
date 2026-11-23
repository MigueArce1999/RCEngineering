"use client";

import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Camera, Check, Copy, Download, ExternalLink, Eye, Layers3, Link2, MessageSquare, QrCode, ShieldCheck, TrendingUp, UserRoundPlus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ProjectShare } from "@/types";
import { useDocs } from "@/stores/docsStore";
import { useProjectStore } from "@/stores/projectStore";
import { BASE_PATH } from "@/lib/asset";
import { cn, formatDate } from "@/lib/format";
import type { ShareInput } from "@/lib/docsApi";
import { GlassButton, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDelete, inputCls } from "./shared";

export const guestUrl = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}${BASE_PATH}/invitado/?t=${encodeURIComponent(token)}`;

const SECTIONS: { key: "showProgress" | "showModel" | "showPhotos" | "showBlueprints"; label: string; icon: ReactNode }[] = [
  { key: "showProgress", label: "Avance por etapas", icon: <TrendingUp size={15} /> },
  { key: "showModel", label: "Modelo 3D", icon: <Box size={15} /> },
  { key: "showPhotos", label: "Fotos de obra", icon: <Camera size={15} /> },
  { key: "showBlueprints", label: "Planos", icon: <Layers3 size={15} /> },
];
const EXPIRY = [
  { days: 0, label: "Siempre" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

const shareStatus = (s: ProjectShare) => (s.revokedAt ? "revoked" : s.expiresAt && new Date(s.expiresAt) < new Date() ? "expired" : "active");

/** Enlaces de invitado: ven información básica, avance, fotos, planos y modelo 3D (nunca finanzas ni nómina). */
export function SharesTab() {
  const shares = useDocs((s) => s.shares);
  const state = useDocs((s) => s.sharesState);
  const load = useDocs((s) => s.loadShares);
  const create = useDocs((s) => s.createShare);
  const projectName = useProjectStore((s) => s.projects.find((p) => p.id === s.projectId)?.name ?? "el proyecto");
  const [form, setForm] = useState<ShareInput & { days: number }>({ label: "", showProgress: true, showModel: true, showPhotos: true, showBlueprints: true, allowComments: true, expiresAt: null, days: 0 });
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    const { days, ...input } = form;
    const s = await create({ ...input, label: input.label.trim() || "Invitado", expiresAt: days ? new Date(Date.now() + days * 86400000).toISOString() : null });
    setBusy(false);
    if (s) {
      setFresh(s.id);
      setForm((f) => ({ ...f, label: "" }));
      void navigator.clipboard?.writeText(guestUrl(s.token)).catch(() => {});
    }
  };

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="anim-stagger mx-auto grid max-w-[1100px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[400px_1fr]">
        {/* Crear enlace */}
        <section className="h-fit rounded-[22px] bg-[#0f2a20] p-5 text-white shadow-[var(--shadow-md)] lg:sticky lg:top-0">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/10">
            <UserRoundPlus size={21} strokeWidth={1.7} />
          </span>
          <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.02em]">Invita a ver {projectName}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">Crea un enlace para clientes, socios o familiares. Entran sin cuenta y solo ven lo que actives aquí.</p>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-[12px] font-medium text-white/70">¿Para quién es?</span>
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} maxLength={120} placeholder="Ej. Cliente · Familia Pérez" className="h-10 w-full rounded-[12px] border border-white/15 bg-white/10 px-3 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-white/40" />
          </label>
          <p className="mt-4 mb-2 text-[12px] font-medium text-white/70">Qué puede ver</p>
          <div className="grid grid-cols-2 gap-2">
            {SECTIONS.map((s) => (
              <button key={s.key} onClick={() => setForm((f) => ({ ...f, [s.key]: !f[s.key] }))} aria-pressed={form[s.key]} className={cn("flex h-11 items-center gap-2 rounded-[12px] px-3 text-left text-[13px] font-medium transition", form[s.key] ? "bg-white text-[#0f2a20]" : "bg-white/8 text-white/60 ring-1 ring-white/12 hover:text-white")}>
                {s.icon}
                <span className="flex-1">{s.label}</span>
                <span className={cn("grid h-4 w-4 place-items-center rounded-full", form[s.key] ? "bg-accent text-white" : "ring-1 ring-white/30")}>{form[s.key] && <Check size={10} strokeWidth={3} />}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setForm((f) => ({ ...f, allowComments: !f.allowComments }))} aria-pressed={form.allowComments} className={cn("mt-2 flex h-11 w-full items-center gap-2 rounded-[12px] px-3 text-left text-[13px] font-medium transition", form.allowComments ? "bg-white text-[#0f2a20]" : "bg-white/8 text-white/60 ring-1 ring-white/12 hover:text-white")}>
            <MessageSquare size={15} />
            <span className="flex-1">Puede dejar comentarios y pedir cambios</span>
            <span className={cn("grid h-4 w-4 place-items-center rounded-full", form.allowComments ? "bg-accent text-white" : "ring-1 ring-white/30")}>{form.allowComments && <Check size={10} strokeWidth={3} />}</span>
          </button>
          <p className="mt-4 mb-2 text-[12px] font-medium text-white/70">Vigencia</p>
          <div className="flex rounded-full bg-white/10 p-1">
            {EXPIRY.map((e) => (
              <button key={e.days} onClick={() => setForm((f) => ({ ...f, days: e.days }))} className={cn("h-8 flex-1 rounded-full text-[12px] font-medium transition", form.days === e.days ? "bg-white text-[#0f2a20]" : "text-white/70 hover:text-white")}>
                {e.label}
              </button>
            ))}
          </div>
          <button onClick={() => void submit()} disabled={busy || !SECTIONS.some((s) => form[s.key])} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-white text-[15px] font-semibold text-[#0f2a20] transition hover:bg-accent-soft disabled:opacity-50">
            <Link2 size={17} /> {busy ? "Creando…" : "Crear enlace y copiar"}
          </button>
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/55">
            <ShieldCheck size={14} className="mt-px shrink-0" /> Nunca se muestran finanzas, cotizaciones, nómina ni datos del equipo. Puedes desactivar el enlace cuando quieras.
          </p>
        </section>

        {/* Enlaces existentes */}
        <section className="min-w-0">
          <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-ink-2 uppercase">Enlaces creados</h3>
          {state === "error" && !shares.length ? (
            <div className="grid h-40 place-items-center rounded-[22px] bg-surface-2/60 text-center">
              <div>
                <p className="text-[14px] text-ink-2">No se pudieron cargar los enlaces.</p>
                <GlassButton variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
                  Reintentar
                </GlassButton>
              </div>
            </div>
          ) : state !== "ready" && !shares.length ? (
            <div className="space-y-3">
              <Skeleton className="h-36 rounded-[20px]" />
              <Skeleton className="h-36 rounded-[20px]" />
            </div>
          ) : !shares.length ? (
            <div className="grid h-56 place-items-center rounded-[22px] border border-dashed border-line-strong text-center">
              <div>
                <Link2 size={26} className="mx-auto text-ink-3" />
                <p className="mt-2 text-[14px] font-medium text-ink">Aún no has invitado a nadie</p>
                <p className="mt-0.5 text-[13px] text-ink-2">Crea el primer enlace con el formulario.</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {shares.map((s) => (
                  <ShareCard key={s.id} share={s} highlight={s.id === fresh} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ShareCard({ share, highlight }: { share: ProjectShare; highlight: boolean }) {
  const save = useDocs((s) => s.saveShare);
  const revoke = useDocs((s) => s.revokeShare);
  const remove = useDocs((s) => s.deleteShare);
  const [copied, setCopied] = useState(highlight);
  const status = shareStatus(share);
  const url = guestUrl(share.token);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard?.writeText(url).then(() => setCopied(true));
  };

  return (
    <motion.li layout initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }} className={cn("rounded-[20px] bg-white p-4 ring-1 transition-shadow duration-700 sm:p-5", highlight ? "shadow-[0_0_0_4px_rgb(46_160_110/0.18)] ring-accent" : "ring-line", status !== "active" && "opacity-70")}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{share.label || "Invitado"}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-2">
            <span className="inline-flex items-center gap-1">
              <Eye size={12} /> {share.viewCount} {share.viewCount === 1 ? "visita" : "visitas"}
            </span>
            {share.lastViewedAt && <span>Última: {formatDate(share.lastViewedAt.slice(0, 10))}</span>}
            <span>{share.expiresAt ? `Vence el ${formatDate(share.expiresAt.slice(0, 10))}` : "Sin vencimiento"}</span>
          </p>
        </div>
        <StatusBadge tone={status === "active" ? "success" : status === "expired" ? "warning" : "neutral"}>{status === "active" ? "Activo" : status === "expired" ? "Vencido" : "Desactivado"}</StatusBadge>
      </div>

      {status === "active" && (
        <div className="mt-3 flex items-center gap-2 rounded-[14px] bg-surface-2/70 p-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">{url.replace(/^https?:\/\//, "")}</span>
          <button onClick={copy} className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-all", copied ? "bg-accent text-white" : "bg-white text-ink ring-1 ring-line hover:ring-line-strong")}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}
          </button>
          <QrButton url={url} label={share.label} />
          <a href={url} target="_blank" rel="noreferrer" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink ring-1 ring-line transition hover:ring-line-strong" aria-label="Abrir la vista de invitado" title="Ver como invitado">
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {SECTIONS.map((s) => (
          <button key={s.key} disabled={status !== "active"} onClick={() => save(share.id, { [s.key]: !share[s.key] })} aria-pressed={share[s.key]} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition disabled:cursor-default", share[s.key] ? "bg-accent-soft text-brand" : "bg-surface-2 text-ink-3 line-through decoration-ink-3/40")}>
            {s.icon} {s.label}
          </button>
        ))}
        <button disabled={status !== "active"} onClick={() => save(share.id, { allowComments: !share.allowComments })} aria-pressed={share.allowComments} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition disabled:cursor-default", share.allowComments ? "bg-accent-soft text-brand" : "bg-surface-2 text-ink-3 line-through decoration-ink-3/40")}>
          <MessageSquare size={15} /> Comentarios
        </button>
        <span className="ml-auto flex items-center gap-1">
          {status === "active" && (
            <GlassButton variant="ghost" size="sm" onClick={() => void revoke(share.id)}>
              Desactivar
            </GlassButton>
          )}
          <ConfirmDelete size="sm" onConfirm={() => void remove(share.id)} />
        </span>
      </div>
    </motion.li>
  );
}

/** Código QR del enlace (para mostrar en obra o enviar por WhatsApp). */
function QrButton({ url, label }: { url: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);
  const build = async () => {
    if (svg) return;
    const QR = await import("qrcode");
    const opts = { margin: 1, color: { dark: "#0f2a20", light: "#ffffff" }, errorCorrectionLevel: "M" as const };
    setSvg(await QR.toString(url, { ...opts, type: "svg" }));
    setPng(await QR.toDataURL(url, { ...opts, width: 1024 }));
  };
  return (
    <Popover.Root onOpenChange={(v) => v && void build()}>
      <Popover.Trigger className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink ring-1 ring-line transition hover:ring-line-strong" aria-label="Código QR">
        <QrCode size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="end" className="anim-pop z-[80] w-[240px] rounded-[18px] bg-white p-4 shadow-[var(--shadow-lg)] ring-1 ring-black/5">
          <div className="aspect-square w-full rounded-[10px] bg-surface-2 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
          <p className="mt-2 text-center text-[12px] text-ink-2">Escanéalo con la cámara del celular</p>
          {png && (
            <a href={png} download={`QR ${label || "invitado"}.png`} className={cn(inputCls, "mt-3 flex h-9 items-center justify-center gap-1.5 text-[13px] font-medium hover:bg-surface-2")}>
              <Download size={14} /> Descargar QR
            </a>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
