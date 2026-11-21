"use client";

import { Loader2, MousePointerClick } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadProjectModel } from "@/lib/api";
import { cn } from "@/lib/format";

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
/** Precarga un modelo ya descargado (evita una segunda descarga). */
export const primeProjectModel = (path: string, html: string) => void cache.set(path, html);

function bridge(settings: Record<string, string>) {
  // Se serializa como JSON y se protege el cierre de etiqueta para no romper el HTML
  const data = JSON.stringify(settings).replace(/</g, "\\u003c");
  return `<script>(function(){var d=${data};function send(){try{parent.postMessage({__rcModel:1,data:d},"*")}catch(e){}}
var s={getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v);send()},removeItem:function(k){delete d[k];send()},clear:function(){d={};send()},key:function(i){return Object.keys(d)[i]||null}};
Object.defineProperty(s,"length",{get:function(){return Object.keys(d).length}});
try{Object.defineProperty(window,"localStorage",{configurable:true,get:function(){return s}})}catch(e){}
document.documentElement.classList.add("rc-compact");
var raf=window.requestAnimationFrame.bind(window),paused=false,q=[],qid=0;
window.requestAnimationFrame=function(cb){if(paused){q.push(cb);return -(++qid)}return raf(cb)};
function pause(v){paused=v;if(!v){var l=q;q=[];l.forEach(function(cb){raf(cb)})}}
addEventListener("message",function(e){if(!e.data)return;if(e.data.__rcView){document.documentElement.classList.toggle("rc-compact",e.data.__rcView==="compact");setTimeout(function(){dispatchEvent(new Event("resize"))},60)}if(typeof e.data.__rcPause==="boolean")pause(e.data.__rcPause)});
})();</script><style>${COMPACT_CSS}</style>`;
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
}) {
  const [html, setHtml] = useState<string | null>(cache.get(path) ?? null);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (cache.has(path)) return;
    let alive = true;
    load(path)
      .then((text) => {
        cache.set(path, text);
        if (alive) setHtml(text);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [path, load]);

  // Mensajes del puente de almacenamiento (solo del iframe propio)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!onSettings || e.source !== frame.current?.contentWindow || !e.data?.__rcModel) return;
      const next = e.data.data as Record<string, unknown>;
      const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => typeof v === "string")) as Record<string, string>;
      onSettings(clean);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSettings]);

  // Cambia de modo sin recargar el modelo (se conserva la cámara)
  const compactRef = useRef(compact);
  useEffect(() => {
    compactRef.current = compact;
    frame.current?.contentWindow?.postMessage({ __rcView: compact ? "compact" : "full" }, "*");
  }, [compact]);
  // Con una pantalla abierta encima, el modelo se pausa (queda su última imagen) y libera la GPU
  const covered = useOverlayOpen() && pauseWhenCovered;
  const coveredRef = useRef(covered);
  useEffect(() => {
    coveredRef.current = covered;
    frame.current?.contentWindow?.postMessage({ __rcPause: covered }, "*");
  }, [covered]);
  const syncMode = () => {
    const w = frame.current?.contentWindow;
    w?.postMessage({ __rcView: compactRef.current ? "compact" : "full" }, "*");
    w?.postMessage({ __rcPause: coveredRef.current }, "*");
  };

  const srcDoc = useMemo(() => {
    if (!html) return undefined;
    const inject = bridge(settings);
    return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + inject) : inject + html;
  }, [html, settings]);

  return (
    <div className="absolute inset-0">
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
