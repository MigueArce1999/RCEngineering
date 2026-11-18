"use client";

import { Edges } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { HOUSE_ELEMENTS, type ElementSpec } from "@/lib/house/spec";
import { elementBuildStatus } from "@/lib/domain";
import { useUI, type ViewMode } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { boxGeometry, getMaterials } from "./materials";

/** Desplazamiento vertical por nivel en la vista explotada (m). */
export const EXPLODE_OFFSET: Record<number, number> = { 0: -1.6, 1: 0, 2: 3.4, 3: 6.8 };

type Treatment = "normal" | "ghost" | "hidden" | "structural" | "status";

function treatmentFor(el: ElementSpec, mode: ViewMode, visibleLevel: number): Treatment {
  const { type, structural, level } = el.meta;
  switch (mode) {
    case "structural":
      if (structural) return "structural";
      return type === "window" || type === "door" || type === "railing" ? "hidden" : "ghost";
    case "roof":
      return type === "roof" ? "normal" : type === "footing" ? "hidden" : "ghost";
    case "levels":
      if (type === "footing") return "hidden";
      return level <= visibleLevel ? "normal" : "hidden";
    case "progress":
      return "status";
    case "exploded":
      return "normal";
    default:
      return type === "footing" ? "hidden" : "normal";
  }
}

/** Grupo por nivel con animación amortiguada hacia la posición objetivo (render bajo demanda). */
function LevelGroup({ level, exploded, children }: { level: number; exploded: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const target = exploded ? EXPLODE_OFFSET[level] : 0;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => invalidate(), [target, invalidate]);
  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const d = target - g.position.y;
    if (Math.abs(d) < 0.002) {
      g.position.y = target;
      return;
    }
    g.position.y += reduced ? d : d * Math.min(1, delta * 6.5);
    state.invalidate();
  });
  return <group ref={ref}>{children}</group>;
}

export function HouseModel() {
  const viewMode = useUI((s) => s.viewMode);
  const visibleLevel = useUI((s) => s.visibleLevel);
  const selectedId = useUI((s) => s.selectedElementId);
  const selectElement = useUI((s) => s.selectElement);
  const tasks = useProjectStore((s) => s.tasks);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const invalidate = useThree((s) => s.invalidate);

  const statusById = useMemo(() => {
    if (viewMode !== "progress") return null;
    return Object.fromEntries(HOUSE_ELEMENTS.map((e) => [e.meta.id, elementBuildStatus(e.meta.id, tasks)]));
  }, [viewMode, tasks]);

  useEffect(() => {
    document.body.style.cursor = hoverId ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoverId]);
  useEffect(() => invalidate(), [viewMode, visibleLevel, selectedId, hoverId, statusById, invalidate]);

  const byLevel = useMemo(() => {
    const groups: Record<number, ElementSpec[]> = { 0: [], 1: [], 2: [], 3: [] };
    HOUSE_ELEMENTS.forEach((e) => groups[e.meta.level].push(e));
    return groups;
  }, []);

  const exploded = viewMode === "exploded";

  return (
    <group name="house">
      {[0, 1, 2, 3].map((lvl) => (
        <LevelGroup key={lvl} level={lvl} exploded={exploded}>
          {byLevel[lvl].map((el) => {
            const treatment = treatmentFor(el, viewMode, visibleLevel);
            if (treatment === "hidden") return null;
            return (
              <ElementMesh
                key={el.meta.id}
                el={el}
                treatment={treatment}
                status={statusById?.[el.meta.id]}
                selected={selectedId === el.meta.id}
                hovered={hoverId === el.meta.id}
                onHover={setHoverId}
                onSelect={selectElement}
              />
            );
          })}
          {lvl === 1 && viewMode !== "structural" && viewMode !== "progress" && <Interior level={1} />}
          {lvl === 2 && viewMode !== "structural" && viewMode !== "progress" && (viewMode !== "levels" || visibleLevel >= 2) && <Interior level={2} />}
        </LevelGroup>
      ))}
    </group>
  );
}

const ElementMesh = memo(function ElementMesh({
  el,
  treatment,
  status,
  selected,
  hovered,
  onHover,
  onSelect,
}: {
  el: ElementSpec;
  treatment: Treatment;
  status?: ReturnType<typeof elementBuildStatus>;
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const m = getMaterials();
  const interactive = treatment !== "ghost";

  const handlers = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(el.meta.id);
        },
        onPointerOut: () => onHover(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          // Ignorar clics que en realidad fueron arrastres de cámara
          if (e.delta > 4) return;
          onSelect(selected ? null : el.meta.id);
        },
      }
    : {};

  return (
    <group name={el.meta.id} userData={{ elementId: el.meta.id }} {...handlers}>
      {el.parts.map((p, i) => {
        const look = p.look ?? "render";
        const transparentLook = look === "glass" || look === "railing";
        let material: THREE.Material;
        if (treatment === "ghost") material = transparentLook ? m.ghostGlass : m.ghost;
        else if (treatment === "structural") material = m.structural;
        else if (treatment === "status") material = transparentLook && status !== "built" ? m.ghostGlass : m.status[status ?? "unlinked"];
        else material = m.looks[look];
        if (selected && treatment !== "ghost") material = transparentLook ? m.selectedGlass : m.selected;
        const solid = !(material as THREE.MeshStandardMaterial).transparent;
        return (
          <mesh
            key={i}
            geometry={boxGeometry(p.size[0], p.size[1], p.size[2])}
            position={p.position}
            material={material}
            castShadow={solid}
            receiveShadow={solid}
            renderOrder={transparentLook ? 2 : 0}
          >
            {(selected || hovered) && treatment !== "ghost" && <Edges threshold={20} color={selected ? "#1f9e63" : "#7fcfa6"} linewidth={selected ? 2.4 : 1.6} />}
          </mesh>
        );
      })}
    </group>
  );
});

/** Volumen interior cálido visible a través del vidrio + mobiliario sugerido (no seleccionable). */
function Interior({ level }: { level: 1 | 2 }) {
  const m = getMaterials().site;
  const y0 = level === 1 ? 0.15 : 3.45;
  const h = level === 1 ? 2.6 : 2.6;
  const x0 = level === 1 ? -9.75 : -4.75;
  const x1 = level === 1 ? 9.75 : 11.25;
  const cx = (x0 + x1) / 2;
  const w = x1 - x0;
  return (
    <group raycast={() => null}>
      <mesh position={[cx, y0 + h / 2, 0]} geometry={boxGeometry(w, h, 11)} material={m.interior} raycast={() => null} />
      <mesh position={[cx, y0 + 0.005, 0]} geometry={boxGeometry(w, 0.01, 11)} material={m.interiorFloor} raycast={() => null} receiveShadow />
      {/* Franjas de luz en cielo raso */}
      {[-3, 0, 3].map((z) => (
        <mesh key={z} position={[cx, y0 + h - 0.02, z]} geometry={boxGeometry(w * 0.7, 0.02, 0.12)} material={m.lamp} raycast={() => null} />
      ))}
      {level === 1 ? (
        <>
          {/* Sala */}
          <mesh position={[-2.5, y0 + 0.22, 3.4]} geometry={boxGeometry(3.2, 0.44, 0.95)} material={m.furniture} raycast={() => null} castShadow />
          <mesh position={[-2.5, y0 + 0.5, 2.95]} geometry={boxGeometry(3.2, 0.5, 0.18)} material={m.furniture} raycast={() => null} />
          <mesh position={[-2.5, y0 + 0.2, 1.9]} geometry={boxGeometry(1.4, 0.4, 0.8)} material={m.furnitureDark} raycast={() => null} />
          {/* Comedor */}
          <mesh position={[2.5, y0 + 0.75, 2.6]} geometry={boxGeometry(2.4, 0.06, 1.0)} material={m.furnitureDark} raycast={() => null} castShadow />
          <mesh position={[2.5, y0 + 0.37, 2.6]} geometry={boxGeometry(0.3, 0.72, 0.3)} material={m.furnitureDark} raycast={() => null} />
          {/* Isla de cocina */}
          <mesh position={[7.5, y0 + 0.46, 2.2]} geometry={boxGeometry(2.6, 0.92, 0.9)} material={m.furniture} raycast={() => null} castShadow />
        </>
      ) : (
        <>
          <mesh position={[-2.5, y0 + 0.28, 1.2]} geometry={boxGeometry(2.0, 0.56, 2.2)} material={m.furniture} raycast={() => null} castShadow />
          <mesh position={[-2.5, y0 + 0.6, 0.05]} geometry={boxGeometry(2.1, 1.0, 0.12)} material={m.furnitureDark} raycast={() => null} />
          <mesh position={[2.5, y0 + 0.22, 3.2]} geometry={boxGeometry(2.6, 0.44, 0.9)} material={m.furniture} raycast={() => null} />
        </>
      )}
    </group>
  );
}
