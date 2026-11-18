"use client";

import * as THREE from "three";
import type { Look } from "@/lib/house/spec";

/**
 * Materiales PBR compartidos del visor. Se crean una sola vez (caché de módulo)
 * y se reutilizan entre mallas para minimizar cambios de estado en la GPU.
 * Las texturas son procedurales (canvas) para no depender de descargas externas.
 */

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeatMeters: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // Las UV de las cajas están en metros (ver boxGeometry) → repetir cada `repeatMeters`
  tex.repeat.set(1 / repeatMeters, 1 / repeatMeters);
  return tex;
}

// Pseudoaleatorio determinista para texturas estables entre recargas
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function stoneTexture() {
  return canvasTexture(
    512,
    (ctx, s) => {
      const r = rng(7);
      ctx.fillStyle = "#5d625f";
      ctx.fillRect(0, 0, s, s);
      // Hiladas horizontales de piedra laja
      let y = 0;
      while (y < s) {
        const h = 14 + r() * 22;
        let x = -r() * 80;
        while (x < s) {
          const w = 60 + r() * 140;
          const v = 78 + r() * 34;
          ctx.fillStyle = `rgb(${v},${v + 3},${v + 1})`;
          ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
          x += w;
        }
        y += h;
      }
    },
    1.6,
  );
}

function woodTexture(base: string, line: string, repeat = 1.2) {
  return canvasTexture(
    256,
    (ctx, s) => {
      const r = rng(11);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 70; i++) {
        ctx.strokeStyle = line;
        ctx.globalAlpha = 0.08 + r() * 0.14;
        ctx.lineWidth = 0.6 + r() * 1.6;
        const y = r() * s;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.3, y + r() * 6 - 3, s * 0.7, y + r() * 6 - 3, s, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // juntas de listones
      ctx.strokeStyle = "rgba(40,24,12,0.35)";
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(0, (k * s) / 6);
        ctx.lineTo(s, (k * s) / 6);
        ctx.stroke();
      }
    },
    repeat,
  );
}

function grassTexture(base: string, spread = 26, repeat = 4) {
  return canvasTexture(
    256,
    (ctx, s) => {
      const r = rng(23);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const g = 110 + r() * spread * 2 - spread;
        ctx.fillStyle = `rgba(${g * 0.5},${g * 0.95},${g * 0.4},0.28)`;
        ctx.fillRect(r() * s, r() * s, 1.5, 1.5 + r() * 2);
      }
    },
    repeat,
  );
}

export interface MaterialSet {
  looks: Record<Look, THREE.Material>;
  ghost: THREE.MeshStandardMaterial;
  selected: THREE.MeshStandardMaterial;
  selectedGlass: THREE.MeshStandardMaterial;
  ghostGlass: THREE.MeshStandardMaterial;
  structural: THREE.MeshStandardMaterial;
  status: Record<"not_started" | "in_progress" | "built" | "unlinked", THREE.MeshStandardMaterial>;
  site: {
    grass: THREE.MeshStandardMaterial;
    plinth: THREE.MeshStandardMaterial;
    paver: THREE.MeshStandardMaterial;
    coping: THREE.MeshStandardMaterial;
    water: THREE.MeshPhysicalMaterial;
    deck: THREE.Material;
    foliage: THREE.MeshStandardMaterial[];
    trunk: THREE.MeshStandardMaterial;
    hedge: THREE.MeshStandardMaterial;
    interior: THREE.MeshStandardMaterial;
    interiorFloor: THREE.MeshStandardMaterial;
    lamp: THREE.MeshStandardMaterial;
    furniture: THREE.MeshStandardMaterial;
    furnitureDark: THREE.MeshStandardMaterial;
  };
}

let cache: MaterialSet | null = null;

export function getMaterials(): MaterialSet {
  if (cache) return cache;
  const wood = woodTexture("#8b5e3c", "#3d2412");
  const deckTex = woodTexture("#a47a55", "#4a2f19", 1.5);
  const grass = grassTexture("#4f7f3f", 20);
  const sedum = grassTexture("#6c8a52", 34, 2);

  const looks: Record<Look, THREE.Material> = {
    render: new THREE.MeshStandardMaterial({ color: "#f3f2ee", roughness: 0.82, metalness: 0 }),
    concrete: new THREE.MeshStandardMaterial({ color: "#b8bcb7", roughness: 0.92 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, color: "#ffffff" }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#9db7b2",
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.32,
      envMapIntensity: 2.2,
      clearcoat: 1,
      depthWrite: false,
    }),
    wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6 }),
    frame: new THREE.MeshStandardMaterial({ color: "#2b302f", roughness: 0.38, metalness: 0.6 }),
    slats: new THREE.MeshStandardMaterial({ color: "#1d5b3b", roughness: 0.45, metalness: 0.25 }),
    roofGreen: new THREE.MeshStandardMaterial({ map: sedum, roughness: 1 }),
    railing: new THREE.MeshPhysicalMaterial({ color: "#c9dcd8", transparent: true, opacity: 0.22, roughness: 0.03, envMapIntensity: 2, depthWrite: false }),
    deck: new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.7 }),
  };

  cache = {
    looks,
    ghost: new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, roughness: 1, depthWrite: false }),
    selected: new THREE.MeshStandardMaterial({ color: "#d9f2e4", emissive: "#2fae73", emissiveIntensity: 0.28, roughness: 0.6 }),
    selectedGlass: new THREE.MeshStandardMaterial({ color: "#8fdcb5", emissive: "#2fae73", emissiveIntensity: 0.35, transparent: true, opacity: 0.55, depthWrite: false }),
    ghostGlass: new THREE.MeshStandardMaterial({ color: "#dfe9e5", transparent: true, opacity: 0.05, depthWrite: false }),
    structural: new THREE.MeshStandardMaterial({ color: "#a9b0ab", roughness: 0.88 }),
    status: {
      not_started: new THREE.MeshStandardMaterial({ color: "#d3dad6", roughness: 0.9 }),
      in_progress: new THREE.MeshStandardMaterial({ color: "#e0a64a", roughness: 0.75 }),
      built: new THREE.MeshStandardMaterial({ color: "#3fb27f", roughness: 0.7 }),
      unlinked: new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.18, depthWrite: false }),
    },
    site: {
      grass: new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }),
      plinth: new THREE.MeshStandardMaterial({ color: "#eceeea", roughness: 0.85 }),
      paver: new THREE.MeshStandardMaterial({ color: "#d8d6cf", roughness: 0.9 }),
      coping: new THREE.MeshStandardMaterial({ color: "#f1efe9", roughness: 0.7 }),
      water: new THREE.MeshPhysicalMaterial({
        color: "#5ec4cf",
        roughness: 0.05,
        metalness: 0.05,
        clearcoat: 1,
        envMapIntensity: 1.6,
        emissive: "#1d7f8c",
        emissiveIntensity: 0.25,
      }),
      deck: looks.deck,
      foliage: ["#3f6e3c", "#335f33", "#4c7d45", "#2c5530"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })),
      trunk: new THREE.MeshStandardMaterial({ color: "#6b5644", roughness: 1 }),
      hedge: new THREE.MeshStandardMaterial({ color: "#3e6a3c", roughness: 1 }),
      interior: new THREE.MeshStandardMaterial({ color: "#efe3d1", emissive: "#ffcf96", emissiveIntensity: 0.32, roughness: 1, side: THREE.BackSide }),
      interiorFloor: new THREE.MeshStandardMaterial({ color: "#c9a77f", roughness: 0.6 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#fff3df", emissive: "#ffd9a0", emissiveIntensity: 2.4 }),
      furniture: new THREE.MeshStandardMaterial({ color: "#e9e4dc", roughness: 0.9 }),
      furnitureDark: new THREE.MeshStandardMaterial({ color: "#6f6a63", roughness: 0.8 }),
    },
  };
  return cache;
}

/**
 * Caja con UV en metros: cada cara recibe coordenadas proporcionales a su tamaño real,
 * así las texturas (piedra, madera, grama) conservan escala sin importar la pieza.
 */
const geoCache = new Map<string, THREE.BoxGeometry>();
export function boxGeometry(w: number, h: number, d: number) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Orden de caras en BoxGeometry: +x, −x, +y, −y, +z, −z (4 vértices por cara)
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  uv.needsUpdate = true;
  geoCache.set(key, g);
  return g;
}

/** Libera texturas, materiales y geometrías compartidas (al desmontar el visor). */
export function disposeViewerResources() {
  geoCache.forEach((g) => g.dispose());
  geoCache.clear();
  if (!cache) return;
  const mats: THREE.Material[] = [
    ...Object.values(cache.looks),
    cache.ghost,
    cache.selected,
    cache.selectedGlass,
    cache.ghostGlass,
    cache.structural,
    ...Object.values(cache.status),
    ...Object.values(cache.site).flat(),
  ];
  new Set(mats).forEach((m) => {
    const map = (m as THREE.MeshStandardMaterial).map;
    map?.dispose();
    m.dispose();
  });
  cache = null;
}
