/**
 * Especificación paramétrica de la vivienda de demostración (Residencia RC-001).
 *
 * Este archivo es la ÚNICA fuente de verdad de la geometría provisional:
 *  - El render 3D (HouseModel) dibuja estas piezas.
 *  - El inspector de elementos lee sus metadatos (dimensiones, material, costo paramétrico).
 *  - Las actividades de obra se vinculan a sus identificadores.
 *
 * Unidades: metros. Ejes: x = este, y = arriba, z = sur (fachada principal hacia +z).
 * Cuando exista un GLB/IFC real, cada nodo del modelo debe exponer `userData.elementId`
 * con los mismos identificadores para conservar los vínculos (ver docs/3D-MODELO.md).
 */
import type { ElementType, ModelElement } from "@/types";

export type Look =
  | "render" // pañete + pintura blanca
  | "concrete" // concreto estructural a la vista
  | "stone" // enchape de piedra gris
  | "glass"
  | "wood"
  | "frame" // perfilería de aluminio
  | "slats" // celosía verde
  | "roofGreen" // cubierta verde
  | "railing"
  | "deck";

export interface Part {
  position: [number, number, number];
  size: [number, number, number];
  look?: Look;
}

export interface ElementSpec {
  meta: ModelElement;
  parts: Part[];
}

// ── Parámetros generales ────────────────────────────────────────────────
export const GRID_X = [-10, -5, 0, 5, 10] as const; // ejes 1–5
export const GRID_Z = [5.75, 0, -5.75] as const; // ejes A (fachada) – C (posterior)
export const AXIS_X = ["1", "2", "3", "4", "5"];
export const AXIS_Z = ["A", "B", "C"];

export const FLOOR_1 = 0.15; // nivel de piso terminado N1
export const STOREY = 3.3; // altura entre pisos
export const FLOOR_2 = FLOOR_1 + STOREY; // 3.45
export const ROOF = FLOOR_2 + STOREY; // 6.75
export const SLAB_T = 0.25;
export const BEAM_D = 0.45;
export const BEAM_W = 0.22;
export const COL = 0.4;
export const WALL_T = 0.25;

/** Envolventes construidas (m²): N1 20 × 11.5 = 230 · N2 16.5 × 11.5 = 189.75 → ≈ 420 m² */
export const LEVEL1_X: [number, number] = [-10, 10];
export const LEVEL2_X: [number, number] = [-5, 11.5];
export const DEPTH_Z: [number, number] = [-5.75, 5.75];

// Costos paramétricos de referencia (COP, ficticios, solo para la demo)
const COST = {
  concreteM3: 1_450_000, // concreto 4000 psi + acero + formaleta
  slabM2: 285_000, // losa aligerada
  wallM2: 98_000, // mampostería + pañete + pintura
  stoneM2: 210_000,
  glassM2: 680_000, // aluminio + vidrio templado
  doorUnit: 3_400_000,
  railingMl: 420_000,
  roofM2: 165_000, // impermeabilización + cubierta verde
};

const STAGE_BUILD = "stg-03";
const STAGE_FINISH = "stg-04";

const elements: ElementSpec[] = [];

function bounds(parts: Part[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.position[i] - p.size[i] / 2);
      max[i] = Math.max(max[i], p.position[i] + p.size[i] / 2);
    }
  const size = [0, 1, 2].map((i) => +(max[i] - min[i]).toFixed(2)) as [number, number, number];
  const position = [0, 1, 2].map((i) => +((max[i] + min[i]) / 2).toFixed(3)) as [number, number, number];
  return { size, position };
}

function add(
  id: string,
  type: ElementType,
  name: string,
  level: ModelElement["level"],
  material: string,
  parts: Part[],
  opts: { stageId: string; blueprintIds: string[]; cost?: number; look: Look; structural: boolean; size?: [number, number, number] },
) {
  const b = bounds(parts);
  elements.push({
    meta: {
      id,
      type,
      name,
      level,
      material,
      size: opts.size ?? b.size,
      position: b.position,
      stageId: opts.stageId,
      blueprintIds: opts.blueprintIds,
      estimatedCost: opts.cost ? Math.round(opts.cost / 1000) * 1000 : undefined,
      look: opts.look,
      structural: opts.structural,
    },
    parts: parts.map((p) => ({ ...p, look: p.look ?? opts.look })),
  });
}

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, look?: Look): Part => ({
  position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  size: [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)],
  look,
});

// ── Cimentación: zapatas aisladas ───────────────────────────────────────
GRID_X.forEach((x, i) =>
  GRID_Z.forEach((z, j) => {
    const id = `ZAP-${AXIS_Z[j]}${AXIS_X[i]}`;
    const s = 1.6;
    add(id, "footing", `Zapata ${AXIS_Z[j]}-${AXIS_X[i]}`, 0, "Concreto 3000 psi · acero G60", [box(x - s / 2, x + s / 2, -1.25, -0.85, z - s / 2, z + s / 2)], {
      stageId: STAGE_BUILD,
      blueprintIds: ["bp-est-01"],
      cost: s * s * 0.4 * COST.concreteM3,
      look: "concrete",
      structural: true,
    });
  }),
);

// ── Columnas ────────────────────────────────────────────────────────────
function addColumns(level: 1 | 2, xs: readonly number[], y0: number, y1: number) {
  xs.forEach((x) => {
    const i = GRID_X.indexOf(x as (typeof GRID_X)[number]);
    GRID_Z.forEach((z, j) => {
      const id = `COL-N${level}-${AXIS_Z[j]}${AXIS_X[i]}`;
      add(id, "column", `Columna ${AXIS_Z[j]}-${AXIS_X[i]} · N${level}`, level, "Concreto 4000 psi · 8 Ø 5/8\" G60", [box(x - COL / 2, x + COL / 2, y0, y1, z - COL / 2, z + COL / 2)], {
        stageId: STAGE_BUILD,
        blueprintIds: ["bp-est-01", "bp-est-02"],
        cost: COL * COL * (y1 - y0) * COST.concreteM3,
        look: "render",
        structural: true,
      });
    });
  });
}
addColumns(1, GRID_X, -0.85, FLOOR_2 - SLAB_T);
addColumns(2, GRID_X.slice(1), FLOOR_2, ROOF - SLAB_T);

// ── Vigas ───────────────────────────────────────────────────────────────
function addBeams(level: 2 | 3, x0: number, x1: number, xs: readonly number[], topY: number) {
  const y1 = topY - SLAB_T;
  const y0 = y1 - BEAM_D;
  GRID_Z.forEach((z, j) => {
    add(`VIG-N${level}-${AXIS_Z[j]}`, "beam", `Viga eje ${AXIS_Z[j]} · ${level === 2 ? "entrepiso" : "cubierta"}`, level, "Concreto 4000 psi · 0.22 × 0.45", [box(x0, x1, y0, y1, z - BEAM_W / 2, z + BEAM_W / 2)], {
      stageId: STAGE_BUILD,
      blueprintIds: ["bp-est-03"],
      cost: (x1 - x0) * BEAM_W * BEAM_D * COST.concreteM3,
      look: "render",
      structural: true,
    });
  });
  xs.forEach((x) => {
    const i = GRID_X.indexOf(x as (typeof GRID_X)[number]);
    const z0 = DEPTH_Z[0];
    const z1 = DEPTH_Z[1];
    add(`VIG-N${level}-${AXIS_X[i]}`, "beam", `Viga eje ${AXIS_X[i]} · ${level === 2 ? "entrepiso" : "cubierta"}`, level, "Concreto 4000 psi · 0.22 × 0.45", [box(x - BEAM_W / 2, x + BEAM_W / 2, y0, y1, z0, z1)], {
      stageId: STAGE_BUILD,
      blueprintIds: ["bp-est-03"],
      cost: (z1 - z0) * BEAM_W * BEAM_D * COST.concreteM3,
      look: "render",
      structural: true,
    });
  });
}
addBeams(2, LEVEL1_X[0], LEVEL2_X[1], GRID_X, FLOOR_2);
addBeams(3, LEVEL2_X[0], LEVEL2_X[1], GRID_X.slice(1), ROOF);

// ── Losas ───────────────────────────────────────────────────────────────
const e = COL / 2;
add("LOS-N1", "slab", "Placa de contrapiso · N1", 1, "Concreto 3000 psi e = 0.15 m", [box(LEVEL1_X[0] - e, LEVEL1_X[1] + e, 0, FLOOR_1, DEPTH_Z[0] - e, DEPTH_Z[1] + e)], {
  stageId: STAGE_BUILD,
  blueprintIds: ["bp-est-01", "bp-arq-01"],
  cost: 20.4 * 11.9 * 0.15 * COST.concreteM3,
  look: "render",
  structural: true,
});
add("LOS-N2", "slab", "Losa de entrepiso · N2", 2, "Losa aligerada 4000 psi e = 0.25 m", [box(LEVEL1_X[0] - e, LEVEL2_X[1] + e, FLOOR_2 - SLAB_T, FLOOR_2, DEPTH_Z[0] - e, DEPTH_Z[1] + e)], {
  stageId: STAGE_BUILD,
  blueprintIds: ["bp-est-03", "bp-arq-02"],
  cost: 21.9 * 11.9 * COST.slabM2,
  look: "render",
  structural: true,
});
add("LOS-CUB", "roof", "Losa de cubierta", 3, "Losa aligerada 4000 psi e = 0.25 m", [box(LEVEL2_X[0] - 0.35, LEVEL2_X[1] + 0.35, ROOF - SLAB_T, ROOF, DEPTH_Z[0] - 0.35, DEPTH_Z[1] + 0.35)], {
  stageId: STAGE_BUILD,
  blueprintIds: ["bp-est-04", "bp-cub-01"],
  cost: 17.2 * 12.2 * COST.slabM2,
  look: "render",
  structural: true,
});
add("CUB-VERDE", "roof", "Cubierta verde extensiva", 3, "Impermeabilización + sustrato 8 cm + sedum", [
  box(LEVEL2_X[0] + 0.25, LEVEL2_X[1] - 0.25, ROOF, ROOF + 0.12, DEPTH_Z[0] + 0.25, DEPTH_Z[1] - 0.25, "roofGreen"),
  // pretiles perimetrales
  box(LEVEL2_X[0] - 0.35, LEVEL2_X[1] + 0.35, ROOF, ROOF + 0.3, DEPTH_Z[1] + 0.1, DEPTH_Z[1] + 0.35, "render"),
  box(LEVEL2_X[0] - 0.35, LEVEL2_X[1] + 0.35, ROOF, ROOF + 0.3, DEPTH_Z[0] - 0.35, DEPTH_Z[0] - 0.1, "render"),
  box(LEVEL2_X[0] - 0.35, LEVEL2_X[0] - 0.1, ROOF, ROOF + 0.3, DEPTH_Z[0] - 0.1, DEPTH_Z[1] + 0.1, "render"),
  box(LEVEL2_X[1] + 0.1, LEVEL2_X[1] + 0.35, ROOF, ROOF + 0.3, DEPTH_Z[0] - 0.1, DEPTH_Z[1] + 0.1, "render"),
], { stageId: STAGE_BUILD, blueprintIds: ["bp-cub-01"], cost: 16.5 * 11.5 * COST.roofM2, look: "roofGreen", structural: false });
add("TER-N2", "slab", "Terraza transitable · N2", 2, "Deck en madera teca sobre impermeabilización", [
  box(LEVEL1_X[0] + 0.1, LEVEL2_X[0] - 0.15, FLOOR_2, FLOOR_2 + 0.06, DEPTH_Z[0] + 0.1, DEPTH_Z[1] - 0.1, "deck"),
  box(LEVEL1_X[0] + 0.15, LEVEL1_X[0] + 1.1, FLOOR_2, FLOOR_2 + 0.45, DEPTH_Z[0] + 0.3, DEPTH_Z[1] - 2.5, "roofGreen"),
], { stageId: STAGE_FINISH, blueprintIds: ["bp-arq-02", "bp-cub-01"], cost: 5 * 11.5 * 240_000, look: "deck", structural: false });

// ── Muros, ventanas y puertas ──────────────────────────────────────────
interface Opening {
  from: number; // a lo largo del muro
  to: number;
  sill: number; // altura desde el piso
  head: number;
}

/**
 * Muro recto con vanos. `axis` indica el sentido del muro.
 * Genera las piezas del muro (sin el dintel, resuelto por la viga) y devuelve los vanos para ventanas.
 */
function wall(
  id: string,
  name: string,
  level: 1 | 2,
  axis: "x" | "z",
  fixed: number,
  from: number,
  to: number,
  openings: Opening[],
  look: Look = "render",
) {
  const floor = level === 1 ? FLOOR_1 : FLOOR_2;
  const top = (level === 1 ? FLOOR_2 : ROOF) - SLAB_T - BEAM_D;
  const parts: Part[] = [];
  const mk = (a0: number, a1: number, y0: number, y1: number) => {
    if (a1 - a0 < 0.01 || y1 - y0 < 0.01) return;
    parts.push(
      axis === "x"
        ? box(a0, a1, y0, y1, fixed - WALL_T / 2, fixed + WALL_T / 2, look)
        : box(fixed - WALL_T / 2, fixed + WALL_T / 2, y0, y1, a0, a1, look),
    );
  };
  const sorted = [...openings].sort((a, b) => a.from - b.from);
  let cursor = from;
  for (const o of sorted) {
    mk(cursor, o.from, floor, top);
    mk(o.from, o.to, floor, floor + o.sill);
    mk(o.from, o.to, floor + o.head, top);
    cursor = o.to;
  }
  mk(cursor, to, floor, top);
  const len = to - from;
  const openArea = openings.reduce((s, o) => s + (o.to - o.from) * (o.head - o.sill), 0);
  const area = len * (top - floor) - openArea;
  add(id, "wall", name, level, look === "stone" ? "Bloque #5 + enchape piedra muñeca gris" : "Bloque #5 + pañete + vinilo tipo 1", parts, {
    stageId: STAGE_BUILD,
    blueprintIds: [level === 1 ? "bp-arq-01" : "bp-arq-02", "bp-arq-03"],
    cost: area * (look === "stone" ? COST.wallM2 + COST.stoneM2 : COST.wallM2),
    look,
    structural: false,
    size: axis === "x" ? [+len.toFixed(2), +(top - floor).toFixed(2), WALL_T] : [WALL_T, +(top - floor).toFixed(2), +len.toFixed(2)],
  });
  return { floor, top };
}

function windowEl(id: string, name: string, level: 1 | 2, axis: "x" | "z", fixed: number, o: Opening, mullions = 2) {
  const floor = level === 1 ? FLOOR_1 : FLOOR_2;
  const y0 = floor + o.sill;
  const y1 = floor + o.head;
  const t = 0.06;
  const parts: Part[] = [];
  const pane = axis === "x" ? box(o.from, o.to, y0, y1, fixed - 0.02, fixed + 0.02, "glass") : box(fixed - 0.02, fixed + 0.02, y0, y1, o.from, o.to, "glass");
  parts.push(pane);
  // marco perimetral + parteluces
  const frame = (a0: number, a1: number, b0: number, b1: number) =>
    parts.push(axis === "x" ? box(a0, a1, b0, b1, fixed - t, fixed + t, "frame") : box(fixed - t, fixed + t, b0, b1, a0, a1, "frame"));
  frame(o.from, o.to, y0, y0 + 0.05);
  frame(o.from, o.to, y1 - 0.05, y1);
  frame(o.from, o.from + 0.05, y0, y1);
  frame(o.to - 0.05, o.to, y0, y1);
  for (let k = 1; k <= mullions; k++) {
    const a = o.from + ((o.to - o.from) * k) / (mullions + 1);
    frame(a - 0.025, a + 0.025, y0, y1);
  }
  const w = o.to - o.from;
  const h = o.head - o.sill;
  add(id, "window", name, level, "Aluminio negro mate + vidrio templado 8 mm", parts, {
    stageId: STAGE_FINISH,
    blueprintIds: [level === 1 ? "bp-arq-01" : "bp-arq-02", "bp-det-02"],
    cost: w * h * COST.glassM2,
    look: "glass",
    structural: false,
    size: axis === "x" ? [+w.toFixed(2), +h.toFixed(2), 0.12] : [0.12, +h.toFixed(2), +w.toFixed(2)],
  });
}

function doorEl(id: string, name: string, level: 1 | 2, axis: "x" | "z", fixed: number, o: Opening, kind: "wood" | "glass") {
  const floor = level === 1 ? FLOOR_1 : FLOOR_2;
  const parts: Part[] =
    axis === "x"
      ? [box(o.from + 0.04, o.to - 0.04, floor, floor + o.head, fixed - 0.05, fixed + 0.05, kind === "wood" ? "wood" : "glass")]
      : [box(fixed - 0.05, fixed + 0.05, floor, floor + o.head, o.from + 0.04, o.to - 0.04, kind === "wood" ? "wood" : "glass")];
  // marco
  const f = (a0: number, a1: number, y0: number, y1: number) =>
    parts.push(axis === "x" ? box(a0, a1, y0, y1, fixed - 0.07, fixed + 0.07, "frame") : box(fixed - 0.07, fixed + 0.07, y0, y1, a0, a1, "frame"));
  f(o.from, o.from + 0.05, floor, floor + o.head);
  f(o.to - 0.05, o.to, floor, floor + o.head);
  f(o.from, o.to, floor + o.head - 0.05, floor + o.head);
  add(id, "door", name, level, kind === "wood" ? "Puerta pivotante en madera flor morado" : "Puerta corrediza aluminio + vidrio templado", parts, {
    stageId: STAGE_FINISH,
    blueprintIds: [level === 1 ? "bp-arq-01" : "bp-arq-02", "bp-det-02"],
    cost: kind === "wood" ? COST.doorUnit : (o.to - o.from) * o.head * COST.glassM2,
    look: kind === "wood" ? "wood" : "glass",
    structural: false,
    size: axis === "x" ? [+(o.to - o.from).toFixed(2), o.head, 0.1] : [0.1, o.head, +(o.to - o.from).toFixed(2)],
  });
}

const zf = DEPTH_Z[1]; // fachada principal
const zb = DEPTH_Z[0]; // fachada posterior
const H1 = FLOOR_2 - SLAB_T - BEAM_D - FLOOR_1; // altura libre bajo viga N1 (2.6 m)
const H2 = ROOF - SLAB_T - BEAM_D - FLOOR_2;

// N1 · fachada principal
const doorMain: Opening = { from: -7.3, to: -6.1, sill: 0, head: H1 };
const w101: Opening = { from: -5.9, to: -5.2, sill: 0.3, head: H1 };
wall("MUR-101", "Muro fachada principal · acceso", 1, "x", zf, -10, -5, [doorMain, w101], "stone");
doorEl("PUE-101", "Puerta principal pivotante", 1, "x", zf, doorMain, "wood");
windowEl("VEN-101", "Ventana vestíbulo", 1, "x", zf, w101, 0);
windowEl("VEN-102", "Ventanal sala · corredizo", 1, "x", zf, { from: -4.8, to: -0.2, sill: 0, head: H1 }, 3);
windowEl("VEN-103", "Ventanal comedor · corredizo", 1, "x", zf, { from: 0.2, to: 4.8, sill: 0, head: H1 }, 3);
windowEl("VEN-104", "Ventanal cocina", 1, "x", zf, { from: 5.2, to: 9.8, sill: 0.9, head: H1 }, 2);
wall("MUR-102", "Antepecho cocina", 1, "x", zf, 5.2, 9.8, [{ from: 5.2, to: 9.8, sill: 0.9, head: H1 }]);

// N1 · posterior
const w105: Opening = { from: -4, to: -1, sill: 1.1, head: 2.4 };
const w106: Opening = { from: 6, to: 9, sill: 1.1, head: 2.4 };
const d102: Opening = { from: 1, to: 3.2, sill: 0, head: H1 };
wall("MUR-103", "Muro posterior · N1", 1, "x", zb, -10, 10, [w105, d102, w106]);
windowEl("VEN-105", "Ventana estudio", 1, "x", zb, w105, 1);
windowEl("VEN-106", "Ventana zona de servicios", 1, "x", zb, w106, 1);
doorEl("PUE-102", "Puerta corrediza patio posterior", 1, "x", zb, d102, "glass");

// N1 · laterales
const w107: Opening = { from: 1.2, to: 4.5, sill: 0.9, head: 2.4 };
wall("MUR-104", "Muro lateral occidental · N1", 1, "z", -10, zb, zf, [w107]);
windowEl("VEN-107", "Ventana lateral occidental", 1, "z", -10, w107, 1);
const w108: Opening = { from: -4.2, to: -1.2, sill: 0.9, head: 2.4 };
wall("MUR-105", "Muro lateral oriental · N1", 1, "z", 10, zb, zf, [w108], "stone");
windowEl("VEN-108", "Ventana lateral oriental", 1, "z", 10, w108, 1);

// N2 · fachada principal (marco blanco volado + balcón)
windowEl("VEN-201", "Ventanal habitación principal", 2, "x", zf, { from: -4.8, to: -0.2, sill: 0, head: H2 }, 2);
windowEl("VEN-202", "Ventanal sala de estar · N2", 2, "x", zf, { from: 0.2, to: 4.8, sill: 0, head: H2 }, 2);
const w203: Opening = { from: 7, to: 10.6, sill: 0.9, head: H2 - 0.2 };
wall("MUR-201", "Muro fachada · N2 oriente", 2, "x", zf, 5, 11.5, [w203]);
windowEl("VEN-203", "Ventana habitación 2", 2, "x", zf, w203, 1);
add("MAR-201", "wall", "Marco volado de fachada · N2", 2, "Estructura liviana + panel fibrocemento + pintura elastomérica", [
  box(-5.25, 5.25, ROOF - SLAB_T - 0.05, ROOF - SLAB_T + 0.2, zf, zf + 1.6, "render"),
  box(-5.25, -4.85, FLOOR_2, ROOF - SLAB_T, zf, zf + 1.6, "render"),
  box(4.85, 5.25, FLOOR_2, ROOF - SLAB_T, zf, zf + 1.6, "render"),
], { stageId: STAGE_BUILD, blueprintIds: ["bp-arq-02", "bp-arq-03"], cost: 22 * COST.wallM2 * 2.2, look: "render", structural: false });
add("BAL-201", "slab", "Balcón en voladizo · N2", 2, "Losa maciza 4000 psi e = 0.20 m", [box(-4.85, 4.85, FLOOR_2 - 0.2, FLOOR_2, zf + 0.2, zf + 1.6, "render")], {
  stageId: STAGE_BUILD,
  blueprintIds: ["bp-est-03"],
  cost: 9.7 * 1.4 * 0.2 * COST.concreteM3,
  look: "render",
  structural: true,
});
add("BAR-201", "railing", "Baranda de vidrio · balcón", 2, "Vidrio templado laminado 10+10 mm", [
  box(-4.85, 4.85, FLOOR_2, FLOOR_2 + 1.05, zf + 1.5, zf + 1.54, "railing"),
], { stageId: STAGE_FINISH, blueprintIds: ["bp-det-02"], cost: 9.7 * COST.railingMl, look: "railing", structural: false });
add("BAR-202", "railing", "Baranda de vidrio · terraza", 2, "Vidrio templado laminado 10+10 mm", [
  box(-10, -5.2, FLOOR_2, FLOOR_2 + 1.05, zf + 0.05, zf + 0.09, "railing"),
  box(-10.09, -10.05, FLOOR_2, FLOOR_2 + 1.05, zb, zf, "railing"),
], { stageId: STAGE_FINISH, blueprintIds: ["bp-det-02"], cost: 16.3 * COST.railingMl, look: "railing", structural: false });

// Celosía verde vertical a doble altura
const slatParts: Part[] = [];
for (let k = 0; k < 9; k++) {
  const x = 5.35 + k * 0.17;
  slatParts.push(box(x - 0.035, x + 0.035, FLOOR_1, ROOF + 0.3, zf + 0.25, zf + 0.37, "slats"));
}
slatParts.push(box(5.25, 6.85, ROOF + 0.25, ROOF + 0.32, zf + 0.2, zf + 0.42, "frame"));
add("CEL-001", "wall", "Celosía vertical de fachada", 1, "Perfil de aluminio con pintura electrostática verde RAL 6005", slatParts, {
  stageId: STAGE_FINISH,
  blueprintIds: ["bp-arq-03", "bp-det-01"],
  cost: 1.6 * 6.9 * 520_000,
  look: "slats",
  structural: false,
});

// N2 · posterior y laterales
const w204: Opening = { from: -3.5, to: 0, sill: 0.9, head: H2 - 0.2 };
const w205: Opening = { from: 4, to: 9.5, sill: 1.6, head: H2 - 0.2 };
wall("MUR-202", "Muro posterior · N2", 2, "x", zb, -5, 11.5, [w204, w205]);
windowEl("VEN-204", "Ventana habitación 3", 2, "x", zb, w204, 1);
windowEl("VEN-205", "Ventana baños · N2", 2, "x", zb, w205, 3);
const d201: Opening = { from: 0.8, to: 4.6, sill: 0, head: H2 };
wall("MUR-203", "Muro hacia terraza · N2", 2, "z", -5, zb, zf, [d201]);
doorEl("PUE-201", "Puerta corrediza a terraza", 2, "z", -5, d201, "glass");
const w206: Opening = { from: -3, to: 2.5, sill: 0.9, head: H2 - 0.2 };
wall("MUR-204", "Muro lateral oriental · N2", 2, "z", 11.5, zb, zf, [w206]);
windowEl("VEN-206", "Ventana lateral · N2", 2, "z", 11.5, w206, 2);

// Columnas de borde en el voladizo (perfil) y alero de madera
add("ALE-201", "slab", "Alero inferior en madera · voladizo", 2, "Listón de teca inmunizada", [
  box(LEVEL1_X[1] + 0.2, LEVEL2_X[1] + 0.2, FLOOR_2 - SLAB_T - 0.04, FLOOR_2 - SLAB_T, zb, zf, "wood"),
], { stageId: STAGE_FINISH, blueprintIds: ["bp-det-01"], cost: 1.5 * 11.5 * 260_000, look: "wood", structural: false });

export const HOUSE_ELEMENTS: ElementSpec[] = elements;
export const ELEMENT_INDEX: Record<string, ModelElement> = Object.fromEntries(elements.map((el) => [el.meta.id, el.meta]));
export const ELEMENT_LIST: ModelElement[] = elements.map((el) => el.meta);

export const ELEMENT_TYPE_LABEL: Record<ElementType, string> = {
  wall: "Muro",
  column: "Columna",
  beam: "Viga",
  slab: "Losa",
  roof: "Cubierta",
  door: "Puerta",
  window: "Ventana",
  footing: "Zapata",
  railing: "Baranda",
  stair: "Escalera",
};

export const LEVEL_LABEL: Record<ModelElement["level"], string> = {
  0: "Cimentación",
  1: "Nivel 1",
  2: "Nivel 2",
  3: "Cubierta",
};
