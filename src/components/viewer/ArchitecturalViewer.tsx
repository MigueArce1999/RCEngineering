"use client";

import dynamic from "next/dynamic";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  Building2,
  Check,
  ChevronDown,
  Columns3,
  Expand,
  Hand,
  Info,
  Layers,
  Map,
  Maximize2,
  Mouse,
  Rotate3d,
  RotateCcw,
  Shrink,
  ZoomIn,
} from "lucide-react";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { useUI, type CameraPreset, type PointerTool, type ViewMode } from "@/stores/uiStore";
import { GlassButton, Skeleton } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";
import { ELEMENT_STATUS_LABEL } from "@/lib/domain";
import { ProjectInfoCard } from "@/components/dashboard/ProjectInfoCard";
import { useProjectStore } from "@/stores/projectStore";
import { ElementInspector } from "./ElementInspector";

const ViewerCanvas = dynamic(() => import("./ViewerCanvas"), { ssr: false, loading: () => <ViewerLoading /> });

export const VIEW_MODES: { key: ViewMode; label: string; description: string; available: boolean; reason?: string }[] = [
  { key: "architectural", label: "Arquitectónica", description: "Volumetría, materiales y emplazamiento", available: true },
  { key: "structural", label: "Estructural", description: "Zapatas, columnas, vigas y losas", available: true },
  { key: "roof", label: "Cubierta", description: "Losa de cubierta y cubierta verde", available: true },
  { key: "levels", label: "Por niveles", description: "Aislar Nivel 1, Nivel 2 o cubierta", available: true },
  { key: "progress", label: "Avance constructivo", description: "Color según actividades vinculadas", available: true },
  { key: "exploded", label: "Explotada", description: "Separación vertical por niveles", available: true },
  { key: "electrical", label: "Instalaciones eléctricas", description: "Circuitos y salidas", available: false, reason: "Requiere un modelo BIM/IFC con la disciplina eléctrica" },
  { key: "plumbing", label: "Hidrosanitaria", description: "Redes de agua y desagües", available: false, reason: "Requiere un modelo BIM/IFC con redes hidrosanitarias" },
];

const CAMERA_BUTTONS: { key: CameraPreset; label: string }[] = [
  { key: "iso", label: "Isométrica" },
  { key: "front", label: "Frontal" },
  { key: "back", label: "Posterior" },
  { key: "side", label: "Lateral" },
  { key: "top", label: "Superior" },
];

// ── Detección de WebGL (una sola vez, sin estado en efectos) ───────────
let webglCache: boolean | null = null;
function detectWebGL() {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}
const noopSubscribe = () => () => {};

class CanvasBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[RC Viewer]", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ArchitecturalViewer() {
  const immersive = useUI((s) => s.immersive);
  const setImmersive = useUI((s) => s.setImmersive);
  const viewMode = useUI((s) => s.viewMode);
  const setViewMode = useUI((s) => s.setViewMode);
  const selectedId = useUI((s) => s.selectedElementId);
  const focusNonce = useUI((s) => s.focusElementNonce);
  const openBlueprints = useUI((s) => s.openBlueprints);
  const goToCamera = useUI((s) => s.goToCamera);
  const remote = useProjectStore((s) => s.source === "remote");
  const webgl = useSyncExternalStore(noopSubscribe, detectWebGL, () => true);
  const rootRef = useRef<HTMLDivElement>(null);
  const [interacted, setInteracted] = useState(false);
  const [panels, setPanels] = useState({ info: true, inspector: true });

  // Bloquear scroll y salir con Escape en modo inmersivo
  useEffect(() => {
    if (!immersive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) setImmersive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [immersive, setImmersive]);

  // Al enfocar un elemento desde búsqueda/actividades, traer el visor a la vista
  useEffect(() => {
    if (focusNonce && !useUI.getState().immersive) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusNonce]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        setImmersive(true);
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setImmersive(true);
    }
  };

  const showInspector = !!selectedId && (panels.inspector || !immersive);
  const showInfo = immersive ? panels.info : !selectedId;

  return (
    <div
      ref={rootRef}
      id="visor-3d"
      className={cn(
        immersive ? "fixed inset-0 z-[45] bg-[#eef3f0]/80 p-2 backdrop-blur-xl sm:p-3" : "relative h-full min-h-[440px]",
      )}
    >
      <motion.section
        initial={{ opacity: 0, scale: 0.97, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.1, delay: 0.12, ease: [0.32, 0.72, 0, 1] }}
        aria-label="Visualizador arquitectónico 3D"
        className="viewer-backdrop relative h-full w-full overflow-hidden rounded-[28px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.7),var(--shadow-md)]"
        onPointerDown={() => setInteracted(true)}
      >
        <div className="absolute inset-0">
          {webgl ? (
            <CanvasBoundary fallback={<NoWebGL onPlans={() => openBlueprints()} reason="error" />}>
              <ViewerCanvas />
            </CanvasBoundary>
          ) : (
            <NoWebGL onPlans={() => openBlueprints()} reason="unsupported" />
          )}
        </div>

        {/* Barra de herramientas superior izquierda */}
        <div className="pointer-events-none absolute top-3 right-3 left-3 flex flex-wrap items-start justify-between gap-2 sm:top-4 sm:right-4 sm:left-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <PointerTools />
            <LayersMenu />
          </div>
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            <span className="hidden md:contents">
              <GlassButton variant="glass" size="md" icon={<Map size={17} strokeWidth={1.8} />} onClick={() => openBlueprints()}>
                Ver planos
              </GlassButton>
            </span>
<span className="hidden wide:contents">
            <GlassButton
              variant="glass"
              size="md"
              icon={<Layers size={17} strokeWidth={1.8} />}
              onClick={() => setViewMode(viewMode === "structural" ? "architectural" : "structural")}
              aria-pressed={viewMode === "structural"}
              className={cn(viewMode === "structural" && "ring-2 ring-accent/60")}
            >
              Detalles estructurales
            </GlassButton>
            </span>
            <Tooltip content="Pantalla completa del navegador">
              <GlassButton variant="glass" size="icon" onClick={toggleFullscreen} aria-label="Pantalla completa">
                <Maximize2 size={17} />
              </GlassButton>
            </Tooltip>
            {immersive ? (
              <GlassButton variant="primary" size="md" icon={<Shrink size={17} />} onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); setImmersive(false); }}>
                Salir de vista 3D
              </GlassButton>
            ) : (
              <GlassButton variant="primary" size="md" icon={<Expand size={17} />} onClick={() => setImmersive(true)}>
                <span className="hidden sm:inline">Entrar a vista 3D</span>
                <span className="sm:hidden">3D</span>
              </GlassButton>
            )}
          </div>
        </div>

        {/* Paneles técnicos (derecha) */}
        <div className={cn("pointer-events-none absolute top-[76px] right-3 hidden w-[356px] flex-col gap-3 sm:right-4 md:flex", immersive ? "bottom-16" : "bottom-3 sm:bottom-4")}>
          <AnimatePresence mode="popLayout">
            {showInfo && (
              <motion.div key="info" className="pointer-events-auto" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}>
                <ProjectInfoCard />
              </motion.div>
            )}
            {showInspector && (
              <motion.div key="inspector" className="pointer-events-auto min-h-0" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}>
                <ElementInspector />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Inspector en pantallas pequeñas */}
        <AnimatePresence>
          {selectedId && (
            <motion.div className="absolute right-3 bottom-16 left-3 md:hidden" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
              <ElementInspector compact />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vistas de cámara + leyendas (abajo izquierda) */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-24px)] flex-col items-start gap-2 sm:bottom-4 sm:left-4 md:max-w-[calc(100%-380px)]">
          <ModeExtras />
          <div className="glass pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1" role="group" aria-label="Vistas de cámara">
            {CAMERA_BUTTONS.map((c) => (
              <button key={c.key} onClick={() => goToCamera(c.key)} className="h-8 shrink-0 rounded-full px-3 text-[12px] font-medium text-ink-2 transition hover:bg-white hover:text-ink">
                {c.label}
              </button>
            ))}
            <Tooltip content="Restablecer cámara">
              <button onClick={() => goToCamera("reset")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 transition hover:bg-white hover:text-ink" aria-label="Restablecer cámara">
                <RotateCcw size={15} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* En proyectos reales el modelo es de referencia hasta cargar el GLB/IFC propio */}
        {remote && (
          <div className="pointer-events-none absolute top-[64px] left-3 sm:top-[68px] sm:left-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-[12px] font-medium text-[#7c5314] shadow-[var(--shadow-xs)]">
              <Info size={13} /> Modelo de referencia · aún no hay modelo 3D de este proyecto
            </span>
          </div>
        )}

        {/* Ayuda contextual */}
        <AnimatePresence>
          {!interacted && !selectedId && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="pointer-events-none absolute bottom-[68px] left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full bg-[#10291f]/45 px-3.5 py-1.5 text-[12px] font-medium text-white backdrop-blur-md lg:flex"
            >
              <Mouse size={14} /> Arrastra para orbitar el modelo en 3D
            </motion.div>
          )}
        </AnimatePresence>

        {immersive && (
          <div className="pointer-events-auto absolute right-4 bottom-4 hidden gap-2 md:flex">
            <GlassButton variant="glass" size="sm" onClick={() => setPanels((p) => ({ ...p, info: !p.info }))} aria-pressed={panels.info}>
              {panels.info ? "Ocultar" : "Mostrar"} información
            </GlassButton>
            <GlassButton variant="glass" size="sm" onClick={() => setPanels((p) => ({ ...p, inspector: !p.inspector }))} aria-pressed={panels.inspector}>
              {panels.inspector ? "Ocultar" : "Mostrar"} propiedades
            </GlassButton>
          </div>
        )}
      </motion.section>
    </div>
  );
}

function PointerTools() {
  const tool = useUI((s) => s.pointerTool);
  const setTool = useUI((s) => s.setPointerTool);
  const tools: { key: PointerTool; label: string; icon: ReactNode; hint: string }[] = [
    { key: "orbit", label: "Orbitar", icon: <Rotate3d size={16} strokeWidth={1.8} />, hint: "Arrastrar para girar alrededor del modelo" },
    { key: "pan", label: "Navegar", icon: <Hand size={16} strokeWidth={1.8} />, hint: "Arrastrar para desplazar la cámara" },
    { key: "zoom", label: "Zoom", icon: <ZoomIn size={16} strokeWidth={1.8} />, hint: "Arrastrar arriba/abajo para acercar (también con la rueda)" },
  ];
  return (
    <div className="glass flex items-center gap-0.5 rounded-full p-1" role="radiogroup" aria-label="Herramienta de navegación">
      {tools.map((t) => (
        <Tooltip key={t.key} content={t.hint}>
          <button
            role="radio"
            aria-checked={tool === t.key}
            onClick={() => setTool(t.key)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition",
              tool === t.key ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

function LayersMenu() {
  const viewMode = useUI((s) => s.viewMode);
  const setViewMode = useUI((s) => s.setViewMode);
  const openBlueprints = useUI((s) => s.openBlueprints);
  const current = VIEW_MODES.find((v) => v.key === viewMode)!;
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="glass flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-ink transition hover:bg-white/85" aria-label={`Capas: vista ${current.label}`}>
          <Layers size={16} strokeWidth={1.8} className="text-brand" />
          Capas
          <span className="sr-only">: {current.label}</span>
          <ChevronDown size={15} className="text-ink-3" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="start" sideOffset={8} className="anim-pop glass-float z-[55] w-[300px] rounded-[18px] p-1.5">
          <Dropdown.Label className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Modo de visualización</Dropdown.Label>
          {VIEW_MODES.map((m) => (
            <Dropdown.Item
              key={m.key}
              disabled={!m.available}
              onSelect={() => setViewMode(m.key)}
              className="flex cursor-pointer items-start gap-2.5 rounded-[12px] px-3 py-2 outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-white/85"
            >
              <span className="mt-0.5 w-4">{viewMode === m.key && <Check size={15} className="text-accent" />}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[13px] font-medium", m.available ? "text-ink" : "text-ink-3")}>{m.label}</span>
                <span className="block text-[12px] leading-snug text-ink-3">{m.available ? m.description : m.reason}</span>
              </span>
              {!m.available && <span className="mt-0.5 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-3 uppercase">No disponible</span>}
            </Dropdown.Item>
          ))}
          <Dropdown.Separator className="hairline my-1" />
          <Dropdown.Item onSelect={() => openBlueprints()} className="flex cursor-pointer items-center gap-2.5 rounded-[12px] px-3 py-2 text-[13px] font-medium text-ink outline-none data-[highlighted]:bg-white/85">
            <span className="w-4" />
            Planos 2D
            <Map size={15} className="ml-auto text-ink-3" />
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function ModeExtras() {
  const viewMode = useUI((s) => s.viewMode);
  const level = useUI((s) => s.visibleLevel);
  const setLevel = useUI((s) => s.setVisibleLevel);
  if (viewMode === "levels")
    return (
      <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1" role="radiogroup" aria-label="Nivel visible">
        {([
          [1, "Nivel 1"],
          [2, "Nivel 2"],
          [3, "Cubierta"],
        ] as const).map(([l, label]) => (
          <button key={l} role="radio" aria-checked={level === l} onClick={() => setLevel(l)} className={cn("h-8 rounded-full px-3 text-[12px] font-medium transition", level === l ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>
    );
  if (viewMode === "progress")
    return (
      <div className="glass pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] px-3 py-2 text-[12px] text-ink-2">
        {(
          [
            ["#d3dad6", ELEMENT_STATUS_LABEL.not_started],
            ["#e0a64a", ELEMENT_STATUS_LABEL.in_progress],
            ["#3fb27f", ELEMENT_STATUS_LABEL.built],
          ] as const
        ).map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: c }} /> {l}
          </span>
        ))}
        <span className="text-ink-3">· según actividades vinculadas</span>
      </div>
    );
  if (viewMode !== "architectural") {
    const extra = viewMode === "structural" ? " · 15 zapatas · 27 columnas · 15 vigas" : "";
    return (
      <div className="glass pointer-events-auto flex items-center gap-2 rounded-[14px] px-3 py-2 text-[12px] text-ink-2">
        <Columns3 size={14} className="text-brand" /> Vista {VIEW_MODES.find((v) => v.key === viewMode)?.label.toLowerCase()}
        {extra}
      </div>
    );
  }
  return null;
}

function ViewerLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-14 w-14">
          <Skeleton className="absolute inset-0 rounded-[18px]" />
          <Box className="absolute inset-0 m-auto text-brand/60" size={24} />
        </div>
        <p className="text-[13px] font-medium text-ink-2">Cargando modelo 3D…</p>
      </div>
    </div>
  );
}

function NoWebGL({ onPlans, reason }: { onPlans: () => void; reason: "unsupported" | "error" }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center">
      <div className="max-w-sm">
        <Building2 className="mx-auto text-brand/70" size={36} strokeWidth={1.5} />
        <p className="mt-3 text-[15px] font-semibold text-ink">{reason === "unsupported" ? "Tu navegador no tiene WebGL disponible" : "No fue posible iniciar el visor 3D"}</p>
        <p className="mt-1 text-[13px] text-ink-2">Puedes seguir consultando el proyecto desde los planos 2D y los módulos de gestión.</p>
        <GlassButton variant="primary" size="md" className="mt-4" icon={<Map size={16} />} onClick={onPlans}>
          Ver planos
        </GlassButton>
      </div>
    </div>
  );
}

