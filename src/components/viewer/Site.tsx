"use client";

import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useUI } from "@/stores/uiStore";
import { boxGeometry, getMaterials } from "./materials";

/** Emplazamiento de maqueta: base, grama, piscina, deck, senderos, vegetación y luminarias. */

export const PLINTH = { x0: -17, x1: 18, z0: -12, z1: 17, top: 0 };
const noRay = () => null;

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function Site() {
  const m = getMaterials().site;
  const viewMode = useUI((s) => s.viewMode);
  const xray = viewMode === "structural";
  const w = PLINTH.x1 - PLINTH.x0;
  const d = PLINTH.z1 - PLINTH.z0;
  const cx = (PLINTH.x0 + PLINTH.x1) / 2;
  const cz = (PLINTH.z0 + PLINTH.z1) / 2;

  // En vista estructural la grama se vuelve translúcida para dejar ver la cimentación
  const grass = useMemo(() => {
    if (!xray) return m.grass;
    const g = m.grass.clone();
    g.transparent = true;
    g.opacity = 0.28;
    g.depthWrite = false;
    return g;
  }, [m.grass, xray]);
  useEffect(() => () => {
    if (grass !== m.grass) grass.dispose();
  }, [grass, m.grass]);

  return (
    <group name="site">
      {/* Base de maqueta */}
      <RoundedBox args={[w + 0.6, 1.6, d + 0.6]} radius={0.3} smoothness={4} position={[cx, -0.82, cz]} material={m.plinth} receiveShadow raycast={noRay} visible={!xray} />
      <mesh position={[cx, -0.01, cz]} geometry={boxGeometry(w, 0.04, d)} material={grass} receiveShadow raycast={noRay} />

      {/* Piscina + deck */}
      <mesh position={[5.2, 0.04, 10.5]} geometry={boxGeometry(10.4, 0.1, 6.4)} material={m.deck} receiveShadow raycast={noRay} />
      <mesh position={[5.5, 0.09, 10.4]} geometry={boxGeometry(8.4, 0.06, 4.2)} material={m.coping} receiveShadow raycast={noRay} />
      <mesh position={[5.5, 0.1, 10.4]} geometry={boxGeometry(7.9, 0.06, 3.7)} material={m.water} raycast={noRay} />
      {/* Tumbonas */}
      {[2.2, 4.0].map((x) => (
        <mesh key={x} position={[x, 0.3, 13.15]} rotation={[-0.12, 0, 0]} geometry={boxGeometry(0.75, 0.16, 1.9)} material={m.furniture} castShadow raycast={noRay} />
      ))}

      {/* Plataforma de acceso y senderos */}
      <mesh position={[-6.7, 0.07, 7.2]} geometry={boxGeometry(3.4, 0.14, 2.6)} material={m.paver} receiveShadow raycast={noRay} />
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[-6.7 - i * 0.35, 0.04, 9.2 + i * 1.15]} geometry={boxGeometry(1.8, 0.06, 0.7)} material={m.paver} receiveShadow raycast={noRay} />
      ))}
      {/* Acceso vehicular bajo el voladizo */}
      <mesh position={[14.2, 0.03, 2.5]} geometry={boxGeometry(5, 0.05, 29)} material={m.paver} receiveShadow raycast={noRay} />

      {/* Luminarias de sendero */}
      {[0, 2, 4, 6].map((i) => (
        <group key={i} position={[-8.2 - i * 0.35, 0, 9.4 + i * 1.15]}>
          <mesh position={[0, 0.3, 0]} geometry={boxGeometry(0.12, 0.6, 0.12)} material={getMaterials().looks.frame} raycast={noRay} />
          <mesh position={[0, 0.56, 0]} geometry={boxGeometry(0.13, 0.08, 0.13)} material={m.lamp} raycast={noRay} />
        </group>
      ))}

      <Hedges />
      <Trees />
    </group>
  );
}

function Hedges() {
  const m = getMaterials().site;
  const runs: [number, number, number, number][] = [
    // [x, z, largo, rotación]
    [-1, -11.2, 30, 0],
    [-16.2, 1.5, 22, Math.PI / 2],
    [-12.5, 16.2, 7, 0],
    [3.5, 16.2, 13, 0],
    [-9.4, 4.6, 1.6, Math.PI / 2],
  ];
  return (
    <group>
      {runs.map(([x, z, len, rot], i) => (
        <RoundedBox key={i} args={[len, 0.9, 0.8]} radius={0.3} smoothness={3} position={[x, 0.45, z]} rotation={[0, rot, 0]} material={m.hedge} castShadow receiveShadow raycast={noRay} />
      ))}
      {/* Jardineras frontales */}
      {[-3.5, -1.3].map((x) => (
        <RoundedBox key={x} args={[1.6, 0.55, 0.9]} radius={0.25} smoothness={3} position={[x, 0.28, 7.0]} material={m.hedge} castShadow raycast={noRay} />
      ))}
    </group>
  );
}

interface TreeDef {
  x: number;
  z: number;
  s: number;
  kind: "round" | "palm";
}

function Trees() {
  const trees = useMemo<TreeDef[]>(
    () => [
      { x: -14.5, z: -9, s: 1.25, kind: "round" },
      { x: -9, z: -9.8, s: 1.05, kind: "round" },
      { x: -2.5, z: -10, s: 1.2, kind: "round" },
      { x: 4.5, z: -9.6, s: 1.0, kind: "round" },
      { x: 10.5, z: -9.8, s: 1.3, kind: "round" },
      { x: -14.6, z: -2, s: 1.0, kind: "round" },
      { x: -14.2, z: 6.5, s: 1.15, kind: "round" },
      { x: -12.2, z: 13.2, s: 0.9, kind: "round" },
      { x: -15.2, z: 15.2, s: 0.95, kind: "palm" },
      { x: 16.4, z: 12.5, s: 0.85, kind: "palm" },
      { x: -2.2, z: 14.6, s: 0.8, kind: "round" },
      { x: 16.2, z: -8.4, s: 1.1, kind: "palm" },
    ],
    [],
  );
  return (
    <group>
      {trees.map((t, i) => (t.kind === "palm" ? <Palm key={i} {...t} seed={i + 3} /> : <RoundTree key={i} {...t} seed={i + 3} />))}
    </group>
  );
}

const sphere = new THREE.IcosahedronGeometry(1, 3);
const trunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 1, 8);

function RoundTree({ x, z, s, seed }: TreeDef & { seed: number }) {
  const m = getMaterials().site;
  const blobs = useMemo(() => {
    const r = rng(seed * 97);
    return Array.from({ length: 11 }).map(() => ({
      p: [(r() - 0.5) * 2.0, 3.0 + r() * 1.8, (r() - 0.5) * 2.0] as [number, number, number],
      sc: 0.55 + r() * 0.5,
      mat: Math.floor(r() * 4),
    }));
  }, [seed]);
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh geometry={trunkGeo} material={m.trunk} position={[0, 1.5, 0]} scale={[1, 3, 1]} castShadow raycast={noRay} />
      {blobs.map((b, i) => (
        <mesh key={i} geometry={sphere} material={m.foliage[b.mat]} position={b.p} scale={[b.sc, b.sc * 0.85, b.sc]} castShadow raycast={noRay} />
      ))}
    </group>
  );
}

const frondGeo = new THREE.SphereGeometry(1, 10, 6);

function Palm({ x, z, s, seed }: TreeDef & { seed: number }) {
  const m = getMaterials().site;
  const fronds = useMemo(() => {
    const r = rng(seed * 31);
    return Array.from({ length: 9 }).map((_, i) => ({ yaw: (i / 9) * Math.PI * 2 + r() * 0.3, droop: 0.35 + r() * 0.35 }));
  }, [seed]);
  const h = 6.2;
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh geometry={trunkGeo} material={m.trunk} position={[0, h / 2, 0]} scale={[1.1, h, 1.1]} castShadow raycast={noRay} />
      {fronds.map((f, i) => (
        <group key={i} position={[0, h, 0]} rotation={[0, f.yaw, 0]}>
          <mesh geometry={frondGeo} material={m.foliage[i % 2]} position={[1.25, -0.3, 0]} rotation={[0, 0, -f.droop]} scale={[1.45, 0.07, 0.32]} castShadow raycast={noRay} />
        </group>
      ))}
    </group>
  );
}
