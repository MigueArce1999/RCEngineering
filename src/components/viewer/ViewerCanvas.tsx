"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl, Environment, Lightformer } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useUI, type CameraPreset } from "@/stores/uiStore";
import { ELEMENT_INDEX } from "@/lib/house/spec";
import { HouseModel, EXPLODE_OFFSET } from "./HouseModel";
import { Site } from "./Site";
import { disposeViewerResources } from "./materials";

const { ACTION } = CameraControlsImpl;

const TARGET: [number, number, number] = [1.6, 1.8, 2.2];

/** Posiciones de cámara [posición, objetivo] para cada vista predefinida. */
export const CAMERA_PRESETS: Record<CameraPreset, [[number, number, number], [number, number, number]]> = {
  iso: [[29, 20, 35], TARGET],
  front: [[0.8, 4.2, 38], [0.8, 3, 0]],
  back: [[0.8, 4.2, -36], [0.8, 3, 0]],
  side: [[38, 4.2, 1], [0.8, 3, 1]],
  top: [[0.8, 46, 1.01], [0.8, 0, 1]],
};

function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const preset = useUI((s) => s.cameraPreset);
  const tool = useUI((s) => s.pointerTool);
  const interactive = useUI((s) => s.immersive || s.viewerActive);
  const focusNonce = useUI((s) => s.focusElementNonce);
  const viewMode = useUI((s) => s.viewMode);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const width = useThree((s) => s.size.width);
  // Instancia de controles registrada por makeDefault: los efectos esperan a que exista
  const hasControls = useThree((s) => !!s.controls);
  const getState = useThree((s) => s.get);
  const intro = useRef({ frames: 0, pending: false });
  const readControls = () => (hasControls ? (getState().controls as unknown as CameraControls) : null);

  // Desplaza el encuadre a la izquierda cuando el panel flotante ocupa la derecha del visor
  useEffect(() => {
    readControls()?.setFocalOffset(width > 760 ? 6.5 : 0, 0, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, hasControls]);

  // Vistas predefinidas
  useEffect(() => {
    const c = readControls();
    if (!c) return;
    const key = preset.preset === "reset" ? "iso" : preset.preset;
    const [p, t] = CAMERA_PRESETS[key];
    if (preset.preset === "reset") c.zoomTo(1, !reduced);
    if (preset.nonce === 0 && !reduced) {
      // Entrada automática: la cámara parte de lo alto y desciende en arco hasta la vista isométrica.
      // Arranca tras los primeros fotogramas (compilación de shaders) para que no se pierda la transición.
      c.setLookAt(p[0] * 1.9, p[1] * 3.2, p[2] * 1.5, ...t, false);
      intro.current = { frames: 0, pending: true };
      return;
    }
    c.setLookAt(...p, ...t, preset.nonce > 0 && !reduced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, reduced, hasControls]);

  useFrame((state) => {
    const it = intro.current;
    if (!it.pending) return;
    state.invalidate();
    if (++it.frames < 4) return;
    it.pending = false;
    const c = readControls();
    if (!c) return;
    const [p, t] = CAMERA_PRESETS.iso;
    c.smoothTime = 0.9;
    c.setLookAt(...p, ...t, true);
    window.setTimeout(() => (c.smoothTime = 0.32), 2800);
  });

  // Herramienta del puntero: orbitar / desplazar / zoom con el botón principal.
  // Mientras el visor no esté activo (sin clic previo), la rueda y el dedo desplazan la página.
  useEffect(() => {
    const c = readControls();
    if (!c) return;
    c.mouseButtons.left = tool === "orbit" ? ACTION.ROTATE : tool === "pan" ? ACTION.TRUCK : ACTION.DOLLY;
    c.mouseButtons.wheel = interactive ? ACTION.DOLLY : ACTION.NONE;
    c.touches.one = !interactive ? ACTION.NONE : tool === "orbit" ? ACTION.TOUCH_ROTATE : tool === "pan" ? ACTION.TOUCH_TRUCK : ACTION.DOLLY;
    c.touches.two = interactive ? ACTION.TOUCH_DOLLY_TRUCK : ACTION.NONE;
    getState().gl.domElement.style.touchAction = interactive ? "none" : "pan-y";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, hasControls, interactive]);

  // Encuadrar un elemento seleccionado desde búsqueda o actividades
  useEffect(() => {
    if (!focusNonce) return;
    const id = useUI.getState().selectedElementId;
    const el = id ? ELEMENT_INDEX[id] : null;
    const c = readControls();
    if (!el || !c) return;
    const dy = viewMode === "exploded" ? EXPLODE_OFFSET[el.level] : 0;
    // Conserva la dirección de vista actual y se acerca a una distancia proporcional al elemento
    const center = new THREE.Vector3(el.position[0], el.position[1] + dy, el.position[2]);
    const pos = c.getPosition(new THREE.Vector3());
    const tgt = c.getTarget(new THREE.Vector3());
    const dir = pos.sub(tgt).normalize();
    const dist = Math.max(14, Math.max(...el.size) * 2.4 + 8);
    const to = center.clone().add(dir.multiplyScalar(dist));
    c.setLookAt(to.x, to.y, to.z, center.x, center.y, center.z, !reduced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce, viewMode, reduced, hasControls]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.32}
      draggingSmoothTime={0.12}
      minDistance={6}
      maxDistance={85}
      maxPolarAngle={Math.PI / 2 - 0.04}
      dollySpeed={0.6}
      truckSpeed={1.6}
    />
  );
}

/** Ajusta la resolución de render a la calidad elegida y libera recursos al desmontar. */
function RenderSettings() {
  const quality = useUI((s) => s.renderQuality);
  const setDpr = useThree((s) => s.setDpr);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setDpr(quality === "high" ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.25));
    invalidate();
  }, [quality, setDpr, invalidate]);
  useEffect(() => () => disposeViewerResources(), []);
  return null;
}

export default function ViewerCanvas({ onReady }: { onReady?: () => void }) {
  const selectElement = useUI((s) => s.selectElement);
  const quality = useUI((s) => s.renderQuality);
  const shadowSize = quality === "high" ? 2048 : 1024;

  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
      camera={{ fov: 32, near: 0.5, far: 400, position: CAMERA_PRESETS.iso[0] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.95;
        onReady?.();
      }}
      onPointerMissed={(e) => {
        if (e.type === "click") selectElement(null);
      }}
      aria-label="Modelo arquitectónico 3D de la Residencia RC-001"
      role="img"
    >
      <RenderSettings />
      <fog attach="fog" args={["#e3ebe6", 70, 150]} />
      <hemisphereLight args={["#ffffff", "#8ea493", 0.55]} />
      <directionalLight
        position={[22, 30, 18]}
        intensity={3.1}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
      <directionalLight position={[-20, 12, -10]} intensity={0.45} color="#dfeaff" />

      {/* Entorno procedural para reflejos en vidrio y agua (sin descargas externas) */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#dfe7e2"]} />
        <Lightformer form="rect" intensity={3} position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#e8f4ff" position={[0, 4, 24]} scale={[40, 8, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#fff1dc" position={[24, 4, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[40, 8, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#cfe6d6" position={[-24, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[40, 6, 1]} />
      </Environment>

      <Site />
      <HouseModel />
      <CameraRig />
    </Canvas>
  );
}
