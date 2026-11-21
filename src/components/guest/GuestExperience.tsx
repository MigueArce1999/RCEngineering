"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useInView, useScroll, useTransform } from "framer-motion";
import { ArrowDown, Box, CalendarDays, ChevronLeft, ChevronRight, Eye, FileText, Layers3, Loader2, MapPin, Maximize2, Minimize2, MoveHorizontal, Ruler, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asset } from "@/lib/asset";
import { CATEGORY_LABEL } from "@/lib/docs";
import { BLUEPRINT_BUCKET, PHOTO_BUCKET } from "@/lib/docsApi";
import { cn, formatDate, parseISODate } from "@/lib/format";
import { downloadGuestModel, fetchGuestView, guestClient, guestProgress, stageState, type GuestBlueprint, type GuestStage, type GuestView } from "@/lib/guest";
import { STAGE_ICONS } from "@/components/dashboard/StagePanel";
import { ProjectModelFrame } from "@/components/viewer/ProjectModelFrame";
import { PlanStage } from "@/components/docs/PlanStage";
import { Lightbox, type LightboxItem } from "@/components/docs/Lightbox";
import { useSignedUrls } from "@/components/docs/useSignedUrls";

const APPLE = [0.32, 0.72, 0, 1] as const;
const EXPO = [0.16, 1, 0.3, 1] as const;
const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const STATUS_LABEL = { active: "En construcción", paused: "En pausa", closed: "Entregado" } as const;

type Load = { state: "loading" } | { state: "invalid" } | { state: "error"; message: string } | { state: "ready"; view: GuestView; client: SupabaseClient; token: string };

/** Vista pública del proyecto para invitados (enlace con token). */
export function GuestExperience() {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t") ?? "";
    const client = token.length >= 32 ? guestClient(token) : null;
    if (!client) {
      queueMicrotask(() => setLoad({ state: "invalid" }));
      return;
    }
    fetchGuestView(client, token)
      .then((view) => setLoad(view ? { state: "ready", view, client, token } : { state: "invalid" }))
      .catch((e: Error) => setLoad({ state: "error", message: e.message }));
  }, []);

  if (load.state === "loading") return <GuestSplash />;
  if (load.state === "invalid") return <GuestMessage title="Este enlace no está disponible" text="Puede haber vencido o haber sido desactivado. Pide un enlace nuevo a quien te lo compartió." />;
  if (load.state === "error") return <GuestMessage title="No pudimos cargar el proyecto" text="Revisa tu conexión a internet e inténtalo de nuevo." action={<button onClick={() => location.reload()} className="mt-6 h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white">Reintentar</button>} />;
  return <GuestPage view={load.view} client={load.client} />;
}

function GuestSplash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#0b1712]">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: APPLE }} className="flex flex-col items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/branding/rc-isotype.svg")} alt="RC Engineering" className="h-12 w-auto brightness-0 invert" />
        <span className="h-0.5 w-24 overflow-hidden rounded-full bg-white/15">
          <motion.span className="block h-full w-1/3 rounded-full bg-white/80" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />
        </span>
      </motion.div>
    </div>
  );
}

function GuestMessage({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: APPLE }} className="max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/branding/rc-isotype.svg")} alt="RC Engineering" className="mx-auto h-11 w-auto" />
        <h1 className="mt-8 text-[26px] font-semibold tracking-[-0.025em] text-ink">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text}</p>
        {action}
      </motion.div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────
function GuestPage({ view, client }: { view: GuestView; client: SupabaseClient }) {
  const { project: p, stages = [], photos = [], blueprints = [], model, share } = view;
  const progress = stages.length ? guestProgress(stages) : null;
  const current = [...stages].sort((a, b) => a.order - b.order).find((s) => stageState(s) !== "completed");
  const loadModel = useCallback((path: string) => downloadGuestModel(client, path), [client]);
  const thumbs = useSignedUrls(client, PHOTO_BUCKET, photos.map((ph) => ph.thumb));
  const heroPhoto = photos[0];
  const heroPhotoUrl = useSignedUrls(client, PHOTO_BUCKET, [heroPhoto?.path])[heroPhoto?.path ?? ""];

  useEffect(() => {
    document.title = `${p.name} · RC Engineering`;
  }, [p.name]);

  const sections = [
    progress !== null && { id: "avance", label: "Avance" },
    photos.length > 0 && { id: "obra", label: "La obra" },
    blueprints.length > 0 && { id: "planos", label: "Planos" },
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <GuestNav sections={sections} />
      <Hero
        name={p.name}
        eyebrow={[p.type, [p.city, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        status={STATUS_LABEL[p.status] ?? ""}
        progress={progress}
        stageName={current?.name}
        model={model}
        loadModel={loadModel}
        photoUrl={heroPhotoUrl}
        next={sections[0]?.id}
      />
      <Facts p={p} />
      {progress !== null && <Progress stages={stages} progress={progress} />}
      {photos.length > 0 && <Photos client={client} photos={photos} thumbs={thumbs} stages={stages} model={model} loadModel={loadModel} />}
      {blueprints.length > 0 && <Blueprints client={client} blueprints={blueprints} />}
      <footer className="border-t border-line/70 px-6 py-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/branding/rc-isotype.svg")} alt="" className="mx-auto h-8 w-auto opacity-80" />
        <p className="mt-4 text-[13px] font-medium text-ink">RC Engineering &amp; Technology Group</p>
        <p className="mx-auto mt-1 flex max-w-md items-center justify-center gap-1.5 text-[12px] text-ink-3">
          <ShieldCheck size={13} /> Vista privada compartida{share.label ? ` con ${share.label}` : ""}.{share.expiresAt && ` Disponible hasta el ${formatDate(share.expiresAt.slice(0, 10))}.`}
        </p>
      </footer>
    </div>
  );
}

function GuestNav({ sections }: { sections: { id: string; label: string }[] }) {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 120], ["rgba(11,23,18,0)", "rgba(255,255,255,0.82)"]);
  const [solid, setSolid] = useState(false);
  useEffect(() => scrollY.on("change", (v) => setSolid(v > 80)), [scrollY]);
  return (
    <motion.header style={{ backgroundColor: bg }} className={cn("fixed inset-x-0 top-0 z-40 transition-[backdrop-filter,box-shadow] duration-300", solid && "shadow-[0_1px_0_rgb(16_41_31/0.06)] backdrop-blur-xl")}>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-5 sm:px-8">
        <span className="flex items-center gap-3">
          <Image src={asset("/branding/rc-isotype.svg")} alt="RC Engineering" width={44} height={26} className={cn("h-7 w-auto transition duration-300", !solid && "brightness-0 invert")} priority />
          <span className={cn("hidden text-[13px] leading-tight font-medium transition-colors duration-300 sm:block", solid ? "text-ink" : "text-white")}>
            RC Engineering &amp;
            <br />
            Technology Group
          </span>
        </span>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={cn("rounded-full px-3.5 py-2 text-[13px] font-medium transition", solid ? "text-ink-2 hover:bg-surface-2 hover:text-ink" : "text-white/80 hover:bg-white/10 hover:text-white")}>
              {s.label}
            </a>
          ))}
        </nav>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-300 md:ml-2", solid ? "bg-accent-soft text-brand" : "bg-white/12 text-white ring-1 ring-white/20", "max-md:ml-auto")}>
          <Eye size={13} /> Vista de invitado
        </span>
      </div>
    </motion.header>
  );
}

// ── Portada ─────────────────────────────────────────────────────────────
function Hero({ name, eyebrow, status, progress, stageName, model, loadModel, photoUrl, next }: { name: string; eyebrow: string; status: string; progress: number | null; stageName?: string; model?: GuestView["model"]; loadModel: (p: string) => Promise<string>; photoUrl?: string; next?: string }) {
  const [explore, setExplore] = useState(false);
  const [active, setActive] = useState(false);
  const { scrollY } = useScroll();
  const textY = useTransform(scrollY, [0, 500], [0, -80]);
  const textOpacity = useTransform(scrollY, [0, 380], [1, 0]);

  useEffect(() => {
    if (!explore) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExplore(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [explore]);

  return (
    <section className="relative h-[100svh] min-h-[560px] overflow-hidden bg-[#0b1712]">
      {/* Fondo: modelo 3D del proyecto, o la foto más reciente de la obra */}
      <div className={cn(explore ? "fixed inset-0 z-[60] bg-[#0b1712]" : "absolute inset-0")}>
        {model ? (
          <ProjectModelFrame path={model.path} settings={model.settings ?? {}} interactive={explore || active} compact={!explore} onActivate={() => setActive(true)} load={loadModel} dark />
        ) : photoUrl ? (
          <motion.div className="absolute inset-0" initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 14, ease: "linear" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          </motion.div>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,#1f5a43_0%,#0b1712_60%)]" />
        )}
        {explore && (
          <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={() => setExplore(false)} className="absolute top-4 right-4 z-10 inline-flex h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-[14px] font-semibold text-ink shadow-[var(--shadow-lg)]">
            <Minimize2 size={16} /> Salir del 3D
          </motion.button>
        )}
      </div>

      {!explore && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b1712] via-[#0b1712]/35 to-[#0b1712]/55" />
          <motion.div style={{ y: textY, opacity: textOpacity }} className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-[1400px] px-5 pb-12 sm:px-8 sm:pb-16">
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15, ease: EXPO }} className="text-[12px] font-semibold tracking-[0.18em] text-white/70 uppercase sm:text-[13px]">
              {eyebrow}
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, delay: 0.25, ease: EXPO }} className="mt-3 max-w-4xl text-[44px] leading-[0.98] font-semibold tracking-[-0.045em] text-white sm:text-[72px] lg:text-[92px]">
              {name.trim()}
            </motion.h1>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.45, ease: EXPO }} className="pointer-events-auto mt-7 flex flex-wrap items-center gap-3">
              {progress !== null && (
                <span className="inline-flex items-center gap-3 rounded-full bg-white/12 py-1.5 pr-4 pl-1.5 text-white ring-1 ring-white/20 backdrop-blur-md">
                  <Ring value={progress} />
                  <span className="text-left leading-tight">
                    <span className="block text-[13px] font-semibold">{status}</span>
                    <span className="block text-[12px] text-white/70">{stageName ? `Etapa actual: ${stageName}` : "Avance general"}</span>
                  </span>
                </span>
              )}
              {model && (
                <button onClick={() => setExplore(true)} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-[#0b1712] shadow-[var(--shadow-lg)] transition hover:scale-[1.03] active:scale-[0.98]">
                  <Box size={18} /> Explorar en 3D
                </button>
              )}
              {next && (
                <a href={`#${next}`} className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white">
                  Ver el proyecto <ArrowDown size={16} />
                </a>
              )}
            </motion.div>
          </motion.div>
          {model && !active && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="pointer-events-none absolute top-24 right-6 hidden items-center gap-2 rounded-full bg-black/30 px-3.5 py-2 text-[12px] font-medium text-white/85 backdrop-blur-md sm:flex">
              <Maximize2 size={13} /> Toca el modelo para girarlo
            </motion.p>
          )}
        </>
      )}
    </section>
  );
}

function Ring({ value, size = 44, stroke = 4, light = true }: { value: number; size?: number; stroke?: number; light?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "rgb(255 255 255 / 0.18)" : "var(--surface-2)"} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "#fff" : "var(--brand-accent)"} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 1.8, delay: 0.6, ease: EXPO }} />
      </svg>
      <span className={cn("tabular absolute text-[12px] font-semibold", light ? "text-white" : "text-ink")}>{Math.round(value * 100)}%</span>
    </span>
  );
}

// ── Datos del proyecto ──────────────────────────────────────────────────
function Facts({ p }: { p: GuestView["project"] }) {
  const facts = [
    p.builtAreaM2 > 0 && { icon: <Ruler size={18} />, value: <CountUp to={Number(p.builtAreaM2)} suffix=" m²" />, label: "Área construida" },
    p.levels > 0 && { icon: <Layers3 size={18} />, value: <CountUp to={p.levels} />, label: p.levels === 1 ? "Nivel" : "Niveles" },
    p.structuralSystem && { icon: <Box size={18} />, value: p.structuralSystem, label: "Sistema estructural" },
    p.city && { icon: <MapPin size={18} />, value: p.city, label: p.country || "Ubicación" },
    p.startDate && { icon: <CalendarDays size={18} />, value: formatDate(p.startDate), label: "Inicio de obra" },
    p.plannedEndDate && { icon: <CalendarDays size={18} />, value: formatDate(p.plannedEndDate), label: "Entrega prevista" },
  ].filter(Boolean) as { icon: ReactNode; value: ReactNode; label: string }[];

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 sm:py-24">
      {p.description && (
        <Reveal>
          <p className="max-w-3xl text-[22px] leading-[1.35] font-medium tracking-[-0.015em] text-ink sm:text-[30px]">{p.description}</p>
        </Reveal>
      )}
      <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-[24px] bg-line/70 ring-1 ring-line/70 md:grid-cols-3 xl:grid-cols-6", p.description && "mt-12")}>
        {facts.map((f, i) => (
          <Reveal key={f.label} delay={i * 0.06} className="bg-white p-5 sm:p-6">
            <span className="text-brand">{f.icon}</span>
            <p className="tabular mt-4 text-[20px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[24px]">{f.value}</p>
            <p className="mt-1 text-[12px] text-ink-2">{f.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      setV(to * (1 - Math.pow(1 - t, 4)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return (
    <span ref={ref}>
      {new Intl.NumberFormat("es-CO", { maximumFractionDigits: to % 1 ? 1 : 0 }).format(v)}
      {suffix}
    </span>
  );
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.9, delay, ease: EXPO }} className={className}>
      {children}
    </motion.div>
  );
}

function SectionTitle({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <Reveal className="mb-10 flex flex-wrap items-end gap-x-8 gap-y-3">
      <div id={id} className="scroll-mt-24">
        <p className="text-[12px] font-semibold tracking-[0.16em] text-accent uppercase">{eyebrow}</p>
        <h2 className="mt-2 text-[34px] leading-[1.02] font-semibold tracking-[-0.035em] text-ink sm:text-[48px]">{title}</h2>
      </div>
      {children}
    </Reveal>
  );
}

// ── Avance ──────────────────────────────────────────────────────────────
function Progress({ stages, progress }: { stages: GuestStage[]; progress: number }) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  return (
    <section className="bg-[#0b1712] text-white">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Reveal>
            <p id="avance" className="scroll-mt-24 text-[12px] font-semibold tracking-[0.16em] text-[#7fd3a8] uppercase">Avance de obra</p>
            <h2 className="mt-2 text-[34px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[48px]">Así avanza tu proyecto</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/65">El avance general pondera cada etapa según su peso en la obra y se actualiza a medida que el equipo completa las actividades.</p>
          </Reveal>
          <Reveal delay={0.1} className="mt-10 flex items-center gap-6">
            <BigRing value={progress} />
            <div>
              <p className="text-[13px] text-white/60">Avance general</p>
              <p className="mt-1 text-[15px] font-medium">
                {sorted.filter((s) => stageState(s) === "completed").length} de {sorted.length} etapas completadas
              </p>
            </div>
          </Reveal>
        </div>
        <ol className="relative space-y-3">
          {sorted.map((s, i) => {
            const st = stageState(s);
            const frac = s.total ? s.done / s.total : 0;
            const Icon = STAGE_ICONS[s.icon] ?? Box;
            return (
              <Reveal key={s.id} delay={i * 0.07}>
                <li className={cn("flex items-center gap-4 rounded-[20px] p-4 ring-1 sm:p-5", st === "in_progress" ? "bg-white text-ink ring-white" : "bg-white/[0.04] ring-white/10")}>
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[14px]", st === "completed" ? "bg-[#2ea06e] text-white" : st === "in_progress" ? "bg-brand text-white" : "bg-white/8 text-white/60")}>
                    <Icon size={19} strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[15px] font-semibold">{s.name}</p>
                      <p className={cn("tabular shrink-0 text-[13px] font-semibold", st === "in_progress" ? "text-brand" : "text-white/70")}>{Math.round(frac * 100)}%</p>
                    </div>
                    <p className={cn("text-[12px]", st === "in_progress" ? "text-ink-2" : "text-white/50")}>{st === "completed" ? "Completada" : st === "in_progress" ? "En proceso" : "Por iniciar"}</p>
                    <div className={cn("mt-2.5 h-1.5 overflow-hidden rounded-full", st === "in_progress" ? "bg-surface-2" : "bg-white/10")}>
                      <motion.div className={cn("h-full rounded-full", st === "completed" ? "bg-[#2ea06e]" : st === "in_progress" ? "bg-accent" : "bg-white/40")} initial={{ width: 0 }} whileInView={{ width: `${Math.max(frac * 100, st === "pending" ? 0 : 3)}%` }} viewport={{ once: true }} transition={{ duration: 1.4, delay: 0.2 + i * 0.08, ease: EXPO }} />
                    </div>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function BigRing({ value }: { value: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const size = 150;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#7fd3a8" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={inView ? { strokeDashoffset: c * (1 - value) } : undefined} transition={{ duration: 2, ease: EXPO }} />
      </svg>
      <span className="absolute text-center">
        <span className="tabular block text-[38px] leading-none font-semibold tracking-[-0.03em]">{inView ? <CountUp to={Math.round(value * 100)} /> : 0}%</span>
      </span>
    </span>
  );
}

// ── Fotos de obra ───────────────────────────────────────────────────────
function Photos({ client, photos, thumbs, stages, model, loadModel }: { client: SupabaseClient; photos: NonNullable<GuestView["photos"]>; thumbs: Record<string, string>; stages: GuestStage[]; model?: GuestView["model"]; loadModel: (p: string) => Promise<string> }) {
  const [open, setOpen] = useState<number | null>(null);
  const stageName = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s.name])), [stages]);
  const fullPaths = open === null ? [] : [-1, 0, 1].map((d) => photos[(open + d + photos.length) % photos.length]?.path);
  const fulls = useSignedUrls(client, PHOTO_BUCKET, fullPaths);
  const items: LightboxItem[] = photos.map((ph) => ({ id: ph.id, src: fulls[ph.path], thumb: thumbs[ph.thumb], caption: ph.caption, takenAt: ph.takenAt, stage: ph.stageId ? stageName[ph.stageId] : undefined }));
  const scroller = useRef<HTMLDivElement>(null);
  const scrollBy = (d: number) => scroller.current?.scrollBy({ left: d * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  // Cronología: de la más antigua a la más reciente
  const timeline = photos.map((ph, idx) => ({ ph, idx })).reverse();
  const first = photos[photos.length - 1];
  const last = photos[0];
  const compare = useSignedUrls(client, PHOTO_BUCKET, photos.length > 1 ? [first.path, last.path] : []);

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <SectionTitle id="obra" eyebrow="Registro de obra" title="La obra, foto a foto">
          <div className="ml-auto hidden gap-2 sm:flex">
            <button onClick={() => scrollBy(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-line transition hover:ring-line-strong" aria-label="Anteriores">
              <ChevronLeft size={19} />
            </button>
            <button onClick={() => scrollBy(1)} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-line transition hover:ring-line-strong" aria-label="Siguientes">
              <ChevronRight size={19} />
            </button>
          </div>
        </SectionTitle>
      </div>

      <div ref={scroller} className="scroll-thin flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [--gutter:1.25rem] sm:[--gutter:max(2rem,calc((100vw-1400px)/2+2rem))]" style={{ paddingInline: "var(--gutter)", scrollPaddingInline: "var(--gutter)" }}>
        {timeline.map(({ ph, idx }, i) => {
          const showMonth = i === 0 || timeline[i - 1].ph.takenAt.slice(0, 7) !== ph.takenAt.slice(0, 7);
          return (
            <motion.button
              key={ph.id}
              onClick={() => setOpen(idx)}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, delay: Math.min(i, 6) * 0.06, ease: EXPO }}
              className="group relative w-[78vw] max-w-[420px] shrink-0 snap-start text-left sm:w-[360px]"
            >
              <span className={cn("mb-3 block h-5 text-[12px] font-semibold tracking-[0.12em] text-ink-2 uppercase first-letter:uppercase", !showMonth && "invisible")}>{monthFmt.format(parseISODate(ph.takenAt))}</span>
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[22px] bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbs[ph.thumb] && <img src={thumbs[ph.thumb]} alt={ph.caption || "Foto de obra"} loading="lazy" className="h-full w-full object-cover transition duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]" />}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-5 pt-16 text-white">
                  <span className="block text-[12px] font-medium text-white/70">{formatDate(ph.takenAt)}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[16px] leading-snug font-semibold">{ph.caption || (ph.stageId ? stageName[ph.stageId] : "Avance de obra")}</span>
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {photos.length > 1 && compare[first.path] && compare[last.path] && (
        <div className="mx-auto mt-20 max-w-[1400px] px-5 sm:px-8">
          <Reveal className="mb-6">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-accent uppercase">Antes y ahora</p>
            <h3 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[36px]">Del primer registro a hoy</h3>
            <p className="mt-2 text-[14px] text-ink-2">Desliza para comparar el {formatDate(first.takenAt)} con el {formatDate(last.takenAt)}.</p>
          </Reveal>
          <Reveal>
            <BeforeAfter before={compare[first.path]} after={compare[last.path]} beforeLabel={formatDate(first.takenAt)} afterLabel={formatDate(last.takenAt)} />
          </Reveal>
        </div>
      )}

      <Lightbox
        items={items}
        index={open}
        onIndex={setOpen}
        onClose={() => setOpen(null)}
        side={model ? <ProjectModelFrame path={model.path} settings={model.settings ?? {}} interactive compact={false} onActivate={() => {}} load={loadModel} pauseWhenCovered={false} dark /> : undefined}
      />
    </section>
  );
}

/** Comparador deslizable entre dos fotos. */
function BeforeAfter({ before, after, beforeLabel, afterLabel }: { before: string; after: string; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={box}
      className="relative aspect-[16/10] w-full cursor-ew-resize touch-pan-y overflow-hidden rounded-[26px] bg-surface-2 select-none sm:aspect-[21/9]"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`Obra el ${afterLabel}`} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={`Obra el ${beforeLabel}`} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <span className="absolute top-4 left-4 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-md">{beforeLabel}</span>
      <span className="absolute top-4 right-4 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-md">{afterLabel}</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_20px_rgb(0_0_0/0.4)]" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 left-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-lg)]">
          <MoveHorizontal size={20} />
        </span>
      </div>
    </div>
  );
}

// ── Planos ──────────────────────────────────────────────────────────────
function Blueprints({ client, blueprints }: { client: SupabaseClient; blueprints: GuestBlueprint[] }) {
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState<GuestBlueprint | null>(null);
  const thumbs = useSignedUrls(client, BLUEPRINT_BUCKET, blueprints.map((b) => b.thumb));
  const files = useSignedUrls(client, BLUEPRINT_BUCKET, [open?.path]);
  const cats = [...new Set(blueprints.map((b) => b.category))];
  const list = blueprints.filter((b) => cat === "all" || b.category === cat);
  const format = open ? (open.mime === "application/pdf" ? "pdf" : "img") : "img";

  return (
    <section className="border-t border-line/70 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <SectionTitle id="planos" eyebrow="Documentación técnica" title="Planos del proyecto">
          {cats.length > 1 && (
            <div className="scroll-thin flex max-w-full gap-1.5 overflow-x-auto sm:ml-auto">
              {["all", ...cats].map((c) => (
                <button key={c} onClick={() => setCat(c)} className={cn("h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition", cat === c ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:text-ink")}>
                  {c === "all" ? "Todos" : CATEGORY_LABEL[c as GuestBlueprint["category"]]}
                </button>
              ))}
            </div>
          )}
        </SectionTitle>
        <motion.div layout className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {list.map((b, i) => (
              <motion.button
                layout
                key={b.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.04, ease: EXPO }}
                onClick={() => setOpen(b)}
                className="group text-left"
              >
                <span className="relative block aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f4f7f5] ring-1 ring-line transition duration-500 group-hover:shadow-[var(--shadow-lg)] group-hover:ring-line-strong">
                  {b.thumb && thumbs[b.thumb] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs[b.thumb]} alt="" loading="lazy" className="h-full w-full object-contain p-3 transition duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]" />
                  ) : (
                    <span className="grid h-full place-items-center text-ink-3">
                      <FileText size={28} />
                    </span>
                  )}
                  <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand shadow-[var(--shadow-xs)]">{b.code}</span>
                </span>
                <span className="mt-3 block truncate text-[14px] font-semibold text-ink">{b.title}</span>
                <span className="block text-[12px] text-ink-2">
                  {CATEGORY_LABEL[b.category]} · {b.revision}
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      <Dialog.Root open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-overlay fixed inset-0 z-[70] bg-[#060d0a]/85" />
          <Dialog.Content className="anim-modal fixed inset-2 z-[70] flex flex-col overflow-hidden rounded-[22px] bg-[#0e1a15] text-white outline-none sm:inset-5" aria-describedby={undefined}>
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate text-[15px] font-semibold">
                  {open?.code} · {open?.title}
                </Dialog.Title>
                <p className="text-[12px] text-white/55">{open && `${CATEGORY_LABEL[open.category]} · ${open.level} · ${open.revision}`}</p>
              </div>
              <Dialog.Close className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" aria-label="Cerrar">
                <X size={19} />
              </Dialog.Close>
            </div>
            <div className="relative min-h-0 flex-1">{open && (files[open.path] ? <PlanStage url={files[open.path]} format={format} title={open.title} dark /> : <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-white/50" /></div>)}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

