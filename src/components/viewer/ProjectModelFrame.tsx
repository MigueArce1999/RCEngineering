"use client";

import { Loader2, MousePointerClick } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadProjectModel } from "@/lib/api";
import { cn } from "@/lib/format";
import { getCachedModel, putCachedModel } from "@/lib/modelCache";
import { GUEST_CSS, patchModel } from "@/lib/modelHook";

/**
 * Muestra el modelo 3D propio del proyecto (HTML autocontenido subido a Storage).
 *
 * Seguridad: se ejecuta en un iframe con sandbox SIN allow-same-origin, así el modelo no puede
 * leer la sesión ni los datos de la app. Como en ese modo no hay localStorage, se inyecta un
 * puente que guarda lo que el modelo escribe (p. ej. "rcrc_alturas") en los ajustes del proyecto.
 */
const cache = new Map<string, string>();

/**
 * Modo compacto (dashboard): se ocultan los paneles y rótulos del modelo para mostrar solo la casa.
 * Selectores del visor "Casa P-C" y nombres habituales de paneles; en vista 3D completa se muestran.
 */
const COMPACT_CSS = `html.rc-compact .ui,html.rc-compact #info,html.rc-compact .compass,html.rc-compact #mini,html.rc-compact #walkHud,html.rc-compact .lbl,html.rc-compact .dimL,html.rc-compact .dimN,html.rc-compact .dimV,html.rc-compact .dimR,html.rc-compact .dimT,html.rc-compact [data-rc-panel]{display:none!important}`;
export interface ModelPin {
  id: string;
  n: number | string;
  p: [number, number, number];
  status?: string;
  active?: boolean;
}
export interface ModelPick {
  p: [number, number, number];
  cam: [number, number, number];
  tgt: [number, number, number];
  fov: number;
  sx: number;
  sy: number;
}
export type ModelCmd = { n: number; type: "view" | "fly" | "walk" | "roof" | "run" | "next" | "prev" | "exitwalk" | "mini" | "lamas" | "cart" | "batch"; arg?: unknown };
export interface ModelStop {
  n: number;
  total: number;
  title: string;
  text: string;
}

/** Precarga un modelo ya descargado (evita una segunda descarga). */
export const primeProjectModel = (path: string, html: string) => void cache.set(path, html);

function bridge(settings: Record<string, string>) {
  // Se serializa como JSON y se protege el cierre de etiqueta para no romper el HTML
  const data = JSON.stringify(settings).replace(/</g, "\\u003c");
  return `<script>(function(){var r0=window.devicePixelRatio||1,cap=Math.min(innerWidth,innerHeight)<700?1.25:2;if(r0>cap)try{Object.defineProperty(window,"devicePixelRatio",{get:function(){return cap}})}catch(e){}})();(function(){var d=${data};function send(){try{parent.postMessage({__rcModel:1,data:d},"*")}catch(e){}}
var s={getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v);send()},removeItem:function(k){delete d[k];send()},clear:function(){d={};send()},key:function(i){return Object.keys(d)[i]||null}};
Object.defineProperty(s,"length",{get:function(){return Object.keys(d).length}});
try{Object.defineProperty(window,"localStorage",{configurable:true,get:function(){return s}})}catch(e){}
document.documentElement.classList.add("rc-compact");
var raf=window.requestAnimationFrame.bind(window),paused=false,q=[],qid=0;
window.requestAnimationFrame=function(cb){if(paused){q.push(cb);return -(++qid)}return raf(cb)};
function pause(v){paused=v;if(!v){var l=q;q=[];l.forEach(function(cb){raf(cb)})}}
addEventListener("message",function(e){if(!e.data)return;if(e.data.__rcView){document.documentElement.classList.toggle("rc-compact",e.data.__rcView==="compact");setTimeout(function(){dispatchEvent(new Event("resize"))},60)}if(typeof e.data.__rcPause==="boolean")pause(e.data.__rcPause)});
})();</script><style>${COMPACT_CSS}${GUEST_CSS}</style>`;
}

/** Verdadero mientras un diálogo de Radix bloquea la página (hay una pantalla abierta encima). */
function useOverlayOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const read = () => setOpen(document.body.hasAttribute("data-scroll-locked"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] });
    return () => mo.disconnect();
  }, []);
  return open;
}

export function ProjectModelFrame({
  path,
  settings,
  interactive,
  compact,
  onActivate,
  onSettings,
  load = downloadProjectModel,
  pauseWhenCovered = true,
  dark = false,
  guest = false,
  commentMode = false,
  pins,
  showLabels = false,
  cmd = null,
  onPick,
  onPinClick,
  onWalk,
  onStop,
}: {
  path: string;
  settings: Record<string, string>;
  interactive: boolean;
  /** Solo la casa (dashboard) o el visor completo con sus paneles (vista 3D) */
  compact: boolean;
  onActivate: () => void;
  onSettings?: (s: Record<string, string>) => void;
  /** Descarga del HTML del modelo (por defecto, con la sesión del usuario) */
  load?: (path: string) => Promise<string>;
  /** Pausar el modelo mientras un diálogo cubre la página */
  pauseWhenCovered?: boolean;
  dark?: boolean;
  /** Vista de invitado: modelo limpio, sin paneles de medidas, lluvia ni edición */
  guest?: boolean;
  /** Un toque sobre el modelo elige un punto para comentar */
  commentMode?: boolean;
  /** Alfileres de comentarios anclados al modelo (coordenadas del modelo) */
  pins?: ModelPin[];
  showLabels?: boolean;
  /** Orden puntual al modelo (cambiar de vista, volar la cámara, recorrido); cambia `n` para enviarla */
  cmd?: ModelCmd | null;
  onPick?: (p: ModelPick) => void;
  onPinClick?: (id: string) => void;
  /** El modelo entró o salió del recorrido en primera persona */
  onWalk?: (on: boolean) => void;
  /** Parada actual del recorrido guiado */
  onStop?: (s: ModelStop) => void;
}) {
  const [html, setHtml] = useState<string | null>(cache.get(path) ?? null);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Los ajustes que el modelo guarda al usarse NO deben recargarlo: se toman una sola vez al montar
  // (la pantalla que lo usa lo remonta con key={path} si cambia el archivo).
  const [boot] = useState(settings);

  // Visibilidad: no se descarga ni se dibuja mientras el visor está fuera de la pantalla (clave en el celular)
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return void setNear(true);
    const io = new IntersectionObserver(
      ([e]) => {
        setOnScreen(e.isIntersecting);
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // La función de descarga se guarda aparte para que un cambio de identidad no reinicie la descarga
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!near || html) return;
    let alive = true;
    const done = (text: string) => {
      cache.set(path, text);
      if (alive) setHtml(text);
    };
    (async () => {
      const stored = await getCachedModel(path); // 2.ª visita: sin descarga
      if (!alive) return;
      if (stored) return done(stored);
      const text = await loadRef.current(path);
      void putCachedModel(path, text);
      done(text);
    })().catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [path, near, html]);

  const onPickRef = useRef(onPick);
  const onPinRef = useRef(onPinClick);
  const onWalkRef = useRef(onWalk);
  const onStopRef = useRef(onStop);
  const pushState = useRef<() => void>(() => {});
  const cmdRef = useRef<ModelCmd | null>(null);
  // Mensajes del puente de almacenamiento (solo del iframe propio)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data) return;
      if (e.data.__rcPick) return onPickRef.current?.(e.data.__rcPick as ModelPick);
      if (e.data.__rcPinClick) return onPinRef.current?.(String(e.data.__rcPinClick));
      if (e.data.__rcStop) return onStopRef.current?.(e.data.__rcStop as ModelStop);
      if (typeof e.data.__rcWalk === "boolean") return onWalkRef.current?.(e.data.__rcWalk);
      if (e.data.__rcReady) {
        pushState.current();
        const c = cmdRef.current;
        if (c?.type === "fly") frame.current?.contentWindow?.postMessage({ __rcCmd: { type: c.type, arg: c.arg } }, "*");
        return;
      }
      if (!onSettings || !e.data.__rcModel) return;
      const next = e.data.data as Record<string, unknown>;
      const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => typeof v === "string")) as Record<string, string>;
      onSettings(clean);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSettings]);

  // Estado deseado → modelo. Se reenvía cuando el modelo avisa que está listo y cada vez que cambia.
  useEffect(() => {
    onPickRef.current = onPick;
    onPinRef.current = onPinClick;
    onWalkRef.current = onWalk;
    onStopRef.current = onStop;
    pushState.current = () => {
      const w = frame.current?.contentWindow;
      w?.postMessage({ __rcG: { guest, labels: showLabels, comment: commentMode, pins: pins ?? [], keepPreview: commentMode } }, "*");
    };
    pushState.current();
  });
  const lastCmd = useRef(0);
  useEffect(() => {
    if (!cmd || cmd.n === lastCmd.current) return;
    lastCmd.current = cmd.n;
    cmdRef.current = cmd;
    frame.current?.contentWindow?.postMessage({ __rcCmd: { type: cmd.type, arg: cmd.arg } }, "*");
  }, [cmd]);

  // Cambia de modo sin recargar el modelo (se conserva la cámara)
  const compactRef = useRef(compact);
  useEffect(() => {
    compactRef.current = compact;
    frame.current?.contentWindow?.postMessage({ __rcView: compact ? "compact" : "full" }, "*");
  }, [compact]);
  // Con una pantalla abierta encima, el modelo se pausa (queda su última imagen) y libera la GPU
  const covered = (useOverlayOpen() && pauseWhenCovered) || !onScreen;
  const coveredRef = useRef(covered);
  useEffect(() => {
    coveredRef.current = covered;
    frame.current?.contentWindow?.postMessage({ __rcPause: covered }, "*");
  }, [covered]);
  const syncMode = () => {
    const w = frame.current?.contentWindow;
    w?.postMessage({ __rcView: compactRef.current ? "compact" : "full" }, "*");
    w?.postMessage({ __rcPause: coveredRef.current }, "*");
    pushState.current();
  };

  const srcDoc = useMemo(() => {
    if (!html) return undefined;
    const inject = bridge(boot);
    const patched = patchModel(html);
    return /<head[^>]*>/i.test(patched) ? patched.replace(/<head[^>]*>/i, (m) => m + inject) : inject + patched;
  }, [html, boot]);

  return (
    <div ref={box} className="absolute inset-0">
      {srcDoc && (
        <iframe
          ref={frame}
          title="Modelo 3D del proyecto"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-pointer-lock"
          onLoad={syncMode}
          className="h-full w-full border-0"
          style={{ pointerEvents: interactive ? "auto" : "none" }}
        />
      )}
      {!srcDoc && !error && (
        <div className="absolute inset-0 grid place-items-center">
          <p className={cn("flex items-center gap-2 text-[13px] font-medium", dark ? "text-white/70" : "text-ink-2")}>
            <Loader2 size={16} className="animate-spin" /> Cargando el modelo del proyecto…
          </p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <p className="max-w-sm text-[13px] text-danger">No se pudo cargar el modelo: {error}</p>
        </div>
      )}
      {/* Capa protectora: mientras no se active, la rueda desplaza la página y no el modelo */}
      {srcDoc && !interactive && (
        <button
          type="button"
          onClick={onActivate}
          className="group absolute inset-0 cursor-pointer"
          aria-label="Activar el modelo 3D para interactuar"
        >
          <span className="pointer-events-none absolute bottom-20 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#10291f]/70 px-4 py-2 text-[13px] font-medium text-white opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
            <MousePointerClick size={15} /> Haz clic para interactuar con el modelo
          </span>
        </button>
      )}
    </div>
  );
}
