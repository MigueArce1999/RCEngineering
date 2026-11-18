// Genera los planos ILUSTRATIVOS de demostración (SVG) en public/blueprints.
// Uso: node scripts/generate-blueprints.mjs
// Geometría coherente con src/lib/house/spec.ts (ejes, envolventes y vanos).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "blueprints");
mkdirSync(OUT, { recursive: true });

const S = 34; // px por metro
const W = 1400;
const H = 990;
const OX = 560; // origen x (x = 0 m)
const OY = 430; // origen z (z = 0 m) — en planta +z (fachada) hacia abajo
const GX = [-10, -5, 0, 5, 10];
const GZ = [5.75, 0, -5.75];
const AX = ["1", "2", "3", "4", "5"];
const AZ = ["A", "B", "C"];
const px = (x) => OX + x * S;
const pz = (z) => OY + z * S;
const INK = "#1d3a30";
const LIGHT = "#8aa096";

const frame = (code, title, scale, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${INK}" stroke-width="2"/>
  <g>${body}</g>
  <g transform="translate(${W - 380} ${H - 190})">
    <rect width="360" height="170" fill="#fff" stroke="${INK}" stroke-width="1.5"/>
    <text x="16" y="30" font-size="15" font-weight="700" fill="${INK}">RC ENGINEERING &amp; TECHNOLOGY GROUP</text>
    <text x="16" y="52" font-size="12" fill="${INK}">Proyecto: Residencia RC-001 · Barranquilla</text>
    <line x1="0" y1="64" x2="360" y2="64" stroke="${INK}"/>
    <text x="16" y="88" font-size="13" font-weight="700" fill="${INK}">${title}</text>
    <text x="16" y="110" font-size="12" fill="${INK}">Plano ${code} · Rev. R0 · Escala ${scale}</text>
    <rect x="0" y="122" width="360" height="48" fill="#fbf1e1"/>
    <text x="16" y="143" font-size="12" font-weight="700" fill="#94631a">ILUSTRATIVO — DATOS DE DEMOSTRACIÓN</text>
    <text x="16" y="160" font-size="11" fill="#94631a">No apto para ejecución constructiva ni trámites.</text>
  </g>
  <text x="${W / 2}" y="${H / 2}" font-size="64" font-weight="700" fill="#c58a30" fill-opacity="0.06" text-anchor="middle" transform="rotate(-24 ${W / 2} ${H / 2})">ILUSTRATIVO · NO APTO PARA CONSTRUCCIÓN</text>
</svg>`;

function axes(x0 = -10, x1 = 11.5) {
  let s = "";
  GX.forEach((x, i) => {
    s += `<line x1="${px(x)}" y1="${pz(-7.6)}" x2="${px(x)}" y2="${pz(7.8)}" stroke="${LIGHT}" stroke-dasharray="14 5 3 5" stroke-width="1"/>`;
    s += `<circle cx="${px(x)}" cy="${pz(-8.3)}" r="13" fill="#fff" stroke="${INK}"/><text x="${px(x)}" y="${pz(-8.3) + 5}" font-size="13" text-anchor="middle" fill="${INK}">${AX[i]}</text>`;
  });
  GZ.forEach((z, j) => {
    s += `<line x1="${px(x0 - 1.4)}" y1="${pz(z)}" x2="${px(x1 + 1)}" y2="${pz(z)}" stroke="${LIGHT}" stroke-dasharray="14 5 3 5" stroke-width="1"/>`;
    s += `<circle cx="${px(x0 - 2)}" cy="${pz(z)}" r="13" fill="#fff" stroke="${INK}"/><text x="${px(x0 - 2)}" y="${pz(z) + 5}" font-size="13" text-anchor="middle" fill="${INK}">${AZ[j]}</text>`;
  });
  return s;
}

function dims(x0, x1) {
  let s = "";
  const y = pz(8.6);
  const pts = [x0, ...GX.filter((g) => g > x0 && g < x1), x1];
  pts.forEach((x, i) => {
    s += `<line x1="${px(x)}" y1="${y - 6}" x2="${px(x)}" y2="${y + 6}" stroke="${INK}"/>`;
    if (i) {
      const a = pts[i - 1];
      s += `<line x1="${px(a)}" y1="${y}" x2="${px(x)}" y2="${y}" stroke="${INK}"/><text x="${(px(a) + px(x)) / 2}" y="${y - 6}" font-size="11" text-anchor="middle" fill="${INK}">${(x - a).toFixed(2)}</text>`;
    }
  });
  return s;
}

const cols = (xs, size = 0.4, fill = INK) => xs.flatMap((x) => GZ.map((z) => `<rect x="${px(x - size / 2)}" y="${pz(z - size / 2)}" width="${size * S}" height="${size * S}" fill="${fill}"/>`)).join("");

function wall(xa, za, xb, zb, t = 0.25, fill = "#c9d2cd") {
  const x = Math.min(xa, xb) - (xa === xb ? t / 2 : 0);
  const z = Math.min(za, zb) - (za === zb ? t / 2 : 0);
  const w = xa === xb ? t : Math.abs(xb - xa);
  const h = za === zb ? t : Math.abs(zb - za);
  return `<rect x="${px(x)}" y="${pz(z)}" width="${w * S}" height="${h * S}" fill="${fill}" stroke="${INK}" stroke-width="1.2"/>`;
}
const win = (xa, xb, z) => `<rect x="${px(xa)}" y="${pz(z) - 3}" width="${(xb - xa) * S}" height="6" fill="#fff" stroke="${INK}"/><line x1="${px(xa)}" y1="${pz(z)}" x2="${px(xb)}" y2="${pz(z)}" stroke="${INK}" stroke-width="0.8"/>`;
const winZ = (x, za, zb) => `<rect x="${px(x) - 3}" y="${pz(za)}" width="6" height="${(zb - za) * S}" fill="#fff" stroke="${INK}"/>`;
const label = (x, z, t, size = 13) => `<text x="${px(x)}" y="${pz(z)}" font-size="${size}" text-anchor="middle" fill="${INK}">${t}</text>`;
const door = (x, z, w, flip = 1) => `<path d="M ${px(x)} ${pz(z)} l ${w * S} 0 M ${px(x)} ${pz(z)} a ${w * S} ${w * S} 0 0 ${flip > 0 ? 0 : 1} ${w * S} ${-flip * w * S}" fill="none" stroke="${INK}" stroke-width="1"/>`;

function planN1(extra = "") {
  return (
    axes() +
    wall(-10, 5.75, -7.3, 5.75, 0.25, "#8f9792") +
    wall(-6.1, 5.75, -5.9, 5.75, 0.25, "#8f9792") +
    win(-5.9, -5.2, 5.75) +
    door(-7.3, 5.75, 1.2) +
    win(-4.8, -0.2, 5.75) +
    win(0.2, 4.8, 5.75) +
    win(5.2, 9.8, 5.75) +
    wall(-10, -5.75, 10, -5.75) +
    win(-4, -1, -5.75) +
    win(6, 9, -5.75) +
    `<rect x="${px(1)}" y="${pz(-5.75) - 4}" width="${2.2 * S}" height="8" fill="#fff" stroke="${INK}"/>` +
    wall(-10, -5.75, -10, 5.75) +
    winZ(-10, 1.2, 4.5) +
    wall(10, -5.75, 10, 5.75, 0.25, "#8f9792") +
    winZ(10, -4.2, -1.2) +
    wall(-5, -5.75, -5, 1.5, 0.12) +
    wall(5, -5.75, 5, -1, 0.12) +
    wall(-10, -1.5, -5, -1.5, 0.12) +
    cols(GX) +
    label(-7.5, 3, "HALL") +
    label(-7.5, -3.6, "ESTUDIO") +
    label(-2.5, 2.4, "SALA") +
    label(2.5, 2.4, "COMEDOR") +
    label(7.5, 2.4, "COCINA") +
    label(7.5, -3.6, "SERVICIOS") +
    label(0, -3.6, "ESCALERA · BAÑO") +
    dims(-10, 10) +
    extra
  );
}

function planN2(extra = "") {
  return (
    axes(-10, 11.5) +
    `<rect x="${px(-10)}" y="${pz(-5.75)}" width="${5 * S}" height="${11.5 * S}" fill="#f2ede4" stroke="${LIGHT}" stroke-dasharray="4 3"/>` +
    label(-7.5, 0, "TERRAZA (deck)") +
    win(-4.8, -0.2, 5.75) +
    win(0.2, 4.8, 5.75) +
    wall(5, 5.75, 7, 5.75) +
    win(7, 10.6, 5.75) +
    wall(10.6, 5.75, 11.5, 5.75) +
    wall(-5, -5.75, 11.5, -5.75) +
    win(-3.5, 0, -5.75) +
    win(4, 9.5, -5.75) +
    wall(-5, -5.75, -5, 0.8) +
    wall(-5, 4.6, -5, 5.75) +
    winZ(-5, 0.8, 4.6) +
    wall(11.5, -5.75, 11.5, 5.75) +
    winZ(11.5, -3, 2.5) +
    `<rect x="${px(-4.85)}" y="${pz(5.95)}" width="${9.7 * S}" height="${1.4 * S}" fill="none" stroke="${INK}" stroke-dasharray="6 3"/>` +
    label(0, 6.9, "BALCÓN", 11) +
    wall(0, -5.75, 0, 1, 0.12) +
    wall(5, -5.75, 5, 5.75, 0.12) +
    cols(GX.slice(1)) +
    label(-2.5, 2.4, "HAB. PRINCIPAL") +
    label(2.5, 2.4, "SALA DE ESTAR") +
    label(8.2, 2.4, "HABITACIÓN 2") +
    label(-2.5, -3.6, "VESTIER · BAÑO") +
    label(8.2, -3.6, "HAB. 3 · BAÑO 2") +
    dims(-5, 11.5) +
    extra
  );
}

const files = {
  "arq-01-planta-n1.svg": frame("ARQ-01", "PLANTA ARQUITECTÓNICA · NIVEL 1", "1:100", planN1()),
  "arq-02-planta-n2.svg": frame("ARQ-02", "PLANTA ARQUITECTÓNICA · NIVEL 2", "1:100", planN2()),
  "arq-03-fachada.svg": frame(
    "ARQ-03",
    "FACHADA PRINCIPAL",
    "1:100",
    (() => {
      const gy = 700;
      const y = (m) => gy - m * S;
      let s = `<line x1="${px(-14)}" y1="${gy}" x2="${px(15)}" y2="${gy}" stroke="${INK}" stroke-width="2"/>`;
      s += `<rect x="${px(-10)}" y="${y(3.45)}" width="${20 * S}" height="${3.45 * S}" fill="#f4f3ef" stroke="${INK}"/>`;
      s += `<rect x="${px(-10)}" y="${y(3.2)}" width="${5 * S}" height="${3.05 * S}" fill="#9aa19d" stroke="${INK}"/>`;
      s += `<rect x="${px(-7.3)}" y="${y(2.75)}" width="${1.2 * S}" height="${2.6 * S}" fill="#a77b55" stroke="${INK}"/>`;
      [[-4.8, -0.2], [0.2, 4.8], [5.2, 9.8]].forEach(([a, b]) => (s += `<rect x="${px(a)}" y="${y(2.75)}" width="${(b - a) * S}" height="${2.6 * S}" fill="#dce8e5" stroke="${INK}"/>`));
      s += `<rect x="${px(-5)}" y="${y(6.75)}" width="${16.5 * S}" height="${3.3 * S}" fill="#f4f3ef" stroke="${INK}"/>`;
      s += `<rect x="${px(-10)}" y="${y(4.5)}" width="${4.9 * S}" height="${1.05 * S}" fill="#e7f0ee" stroke="${INK}" stroke-dasharray="3 2"/>`;
      [[-4.8, -0.2], [0.2, 4.8], [7, 10.6]].forEach(([a, b]) => (s += `<rect x="${px(a)}" y="${y(6.05)}" width="${(b - a) * S}" height="${2.6 * S}" fill="#dce8e5" stroke="${INK}"/>`));
      for (let k = 0; k < 9; k++) s += `<rect x="${px(5.32 + k * 0.17)}" y="${y(7.05)}" width="${0.07 * S}" height="${6.9 * S}" fill="#1d5b3b"/>`;
      s += `<text x="${px(12.5)}" y="${y(3.45) + 4}" font-size="11" fill="${INK}">N+3.45</text><text x="${px(12.5)}" y="${y(6.75) + 4}" font-size="11" fill="${INK}">N+6.75</text><text x="${px(12.5)}" y="${y(0.15) + 4}" font-size="11" fill="${INK}">N+0.15</text>`;
      return s;
    })(),
  ),
  "est-01-cimentacion.svg": frame(
    "EST-01",
    "PLANTA DE CIMENTACIÓN",
    "1:100",
    axes() +
      GX.flatMap((x) => GZ.map((z) => `<rect x="${px(x - 0.8)}" y="${pz(z - 0.8)}" width="${1.6 * S}" height="${1.6 * S}" fill="#eef2ef" stroke="${INK}" stroke-dasharray="5 3"/>`)).join("") +
      GZ.map((z) => `<rect x="${px(-10)}" y="${pz(z) - 4}" width="${20 * S}" height="8" fill="#d9e1dc" stroke="${INK}"/>`).join("") +
      GX.map((x) => `<rect x="${px(x) - 4}" y="${pz(-5.75)}" width="8" height="${11.5 * S}" fill="#d9e1dc" stroke="${INK}"/>`).join("") +
      cols(GX) +
      `<text x="60" y="${H - 120}" font-size="12" fill="${INK}">Z-1: zapata 1.60 × 1.60 × 0.40 m · concreto 3000 psi · parrilla Ø 1/2" @ 0.15</text>` +
      `<text x="60" y="${H - 100}" font-size="12" fill="${INK}">VC: viga de cimentación 0.30 × 0.40 m</text>`,
  ),
  "est-02-columnas.svg": frame(
    "EST-02",
    "CUADRO DE COLUMNAS",
    "Indicada",
    (() => {
      let s = "";
      const rows = [
        ["C-1", "N1", "0.40 × 0.40", "8 Ø 5/8\"", "E Ø 3/8\" @ 0.10 / 0.20", "15"],
        ["C-2", "N2", "0.40 × 0.40", "8 Ø 1/2\"", "E Ø 3/8\" @ 0.10 / 0.20", "12"],
      ];
      const hd = ["TIPO", "NIVEL", "SECCIÓN (m)", "REFUERZO LONG.", "ESTRIBOS", "CANT."];
      const cw = [120, 100, 160, 180, 260, 90];
      let x = 80;
      hd.forEach((h, i) => {
        s += `<rect x="${x}" y="120" width="${cw[i]}" height="40" fill="#edf2ef" stroke="${INK}"/><text x="${x + 10}" y="145" font-size="12" font-weight="700" fill="${INK}">${h}</text>`;
        rows.forEach((r, j) => (s += `<rect x="${x}" y="${160 + j * 40}" width="${cw[i]}" height="40" fill="#fff" stroke="${INK}"/><text x="${x + 10}" y="${185 + j * 40}" font-size="12" fill="${INK}">${r[i]}</text>`));
        x += cw[i];
      });
      [0, 1].forEach((k) => {
        const cx = 260 + k * 360;
        s += `<rect x="${cx}" y="360" width="200" height="200" fill="#eef2ef" stroke="${INK}" stroke-width="2"/><rect x="${cx + 18}" y="378" width="164" height="164" fill="none" stroke="${INK}"/>`;
        [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]].forEach(([a, b]) => (s += `<circle cx="${cx + 30 + a * 140}" cy="${390 + b * 140}" r="${k ? 6 : 8}" fill="${INK}"/>`));
        s += `<text x="${cx + 100}" y="590" font-size="13" text-anchor="middle" fill="${INK}">${k ? "C-2" : "C-1"} · 0.40 × 0.40</text>`;
      });
      return s;
    })(),
  ),
  "est-03-entrepiso.svg": frame(
    "EST-03",
    "PLANTA ESTRUCTURAL DE ENTREPISO · VIGAS N2",
    "1:100",
    axes() +
      `<rect x="${px(-10.2)}" y="${pz(-5.95)}" width="${21.9 * S}" height="${11.9 * S}" fill="#f4f7f5" stroke="${INK}"/>` +
      GZ.map((z, j) => `<rect x="${px(-10)}" y="${pz(z) - 4}" width="${21.5 * S}" height="8" fill="#b8c4bd" stroke="${INK}"/><text x="${px(-8)}" y="${pz(z) - 8}" font-size="11" fill="${INK}">VIG-N2-${AZ[j]} 0.22×0.45</text>`).join("") +
      GX.map((x, i) => `<rect x="${px(x) - 4}" y="${pz(-5.75)}" width="8" height="${11.5 * S}" fill="#b8c4bd" stroke="${INK}"/><text x="${px(x) + 8}" y="${pz(3)}" font-size="11" fill="${INK}" transform="rotate(-90 ${px(x) + 8} ${pz(3)})">VIG-N2-${AX[i]}</text>`).join("") +
      `<rect x="${px(-4.85)}" y="${pz(5.95)}" width="${9.7 * S}" height="${1.4 * S}" fill="#e3ebe6" stroke="${INK}"/>` +
      label(0, 6.9, "BAL-201 losa maciza e=0.20", 11) +
      cols(GX) +
      `<text x="60" y="${H - 120}" font-size="12" fill="${INK}">Losa aligerada e = 0.25 m · viguetas 0.10 × 0.25 @ 0.70 · loseta 0.05</text>`,
  ),
  "est-04-cubierta.svg": frame(
    "EST-04",
    "PLANTA ESTRUCTURAL DE CUBIERTA",
    "1:100",
    axes(-5, 11.5) +
      `<rect x="${px(-5.35)}" y="${pz(-6.1)}" width="${17.2 * S}" height="${12.2 * S}" fill="#f4f7f5" stroke="${INK}"/>` +
      GZ.map((z, j) => `<rect x="${px(-5)}" y="${pz(z) - 4}" width="${16.5 * S}" height="8" fill="#b8c4bd" stroke="${INK}"/><text x="${px(-3)}" y="${pz(z) - 8}" font-size="11" fill="${INK}">VIG-N3-${AZ[j]}</text>`).join("") +
      GX.slice(1).map((x) => `<rect x="${px(x) - 4}" y="${pz(-5.75)}" width="8" height="${11.5 * S}" fill="#b8c4bd" stroke="${INK}"/>`).join("") +
      cols(GX.slice(1)),
  ),
  "ele-01-n1.svg": frame(
    "ELE-01",
    "INSTALACIONES ELÉCTRICAS · NIVEL 1",
    "1:100",
    planN1(
      [[-7.5, 3], [-7.5, -3.5], [-2.5, 2], [2.5, 2], [7.5, 2], [7.5, -3.5], [0, -3.5]]
        .map(([x, z]) => `<circle cx="${px(x)}" cy="${pz(z) - 26}" r="9" fill="#fff" stroke="#3a7ca5" stroke-width="2"/><line x1="${px(x) - 6}" y1="${pz(z) - 32}" x2="${px(x) + 6}" y2="${pz(z) - 20}" stroke="#3a7ca5" stroke-width="1.5"/><line x1="${px(x) + 6}" y1="${pz(z) - 32}" x2="${px(x) - 6}" y2="${pz(z) - 20}" stroke="#3a7ca5" stroke-width="1.5"/>`)
        .join("") +
        [[-9.6, 2], [-9.6, -3], [-4.6, 4], [0.6, 5.2], [4.6, 3], [9.6, 1], [9.6, -4], [3, -5.3]]
          .map(([x, z]) => `<rect x="${px(x) - 6}" y="${pz(z) - 6}" width="12" height="12" fill="#3a7ca5"/>`)
          .join("") +
        `<rect x="${px(8.6)}" y="${pz(-5.4)}" width="40" height="18" fill="#fff" stroke="#3a7ca5" stroke-width="2"/><text x="${px(8.6) + 20}" y="${pz(-5.4) + 13}" font-size="10" text-anchor="middle" fill="#3a7ca5">TG</text>` +
        `<text x="60" y="${H - 120}" font-size="12" fill="#3a7ca5">⊗ Luminaria · ■ Tomacorriente doble · TG Tablero general — esquema ilustrativo</text>`,
    ),
  ),
  "hid-01-n1.svg": frame(
    "HID-01",
    "INSTALACIONES HIDROSANITARIAS · NIVEL 1",
    "1:100",
    planN1(
      `<polyline points="${px(-12)},${pz(7.5)} ${px(-9)},${pz(7.5)} ${px(-9)},${pz(-4.5)} ${px(8)},${pz(-4.5)} ${px(8)},${pz(1.5)}" fill="none" stroke="#3a9cc7" stroke-width="2.5"/>` +
        `<polyline points="${px(0)},${pz(-4)} ${px(0)},${pz(-7.4)} ${px(11)},${pz(-7.4)}" fill="none" stroke="#8a6a3b" stroke-width="3" stroke-dasharray="10 4"/>` +
        `<polyline points="${px(7.5)},${pz(-4)} ${px(7.5)},${pz(-7.4)}" fill="none" stroke="#8a6a3b" stroke-width="3" stroke-dasharray="10 4"/>` +
        `<rect x="${px(11)}" y="${pz(-7.9)}" width="30" height="30" fill="#fff" stroke="#8a6a3b" stroke-width="2"/>` +
        `<text x="60" y="${H - 120}" font-size="12" fill="${INK}"><tspan fill="#3a9cc7">— Agua fría PVC-P 1/2"–3/4"</tspan>   <tspan fill="#8a6a3b">- - Sanitaria PVC-S 4"</tspan>   □ Caja de inspección — esquema ilustrativo</text>`,
    ),
  ),
  "cub-01-cubiertas.svg": frame(
    "CUB-01",
    "PLANTA DE CUBIERTAS",
    "1:100",
    axes(-10, 11.5) +
      `<defs><pattern id="sedum" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="#6c8a52"/><circle cx="8" cy="7" r="1.1" fill="#6c8a52"/></pattern></defs>` +
      `<rect x="${px(-5.35)}" y="${pz(-6.1)}" width="${17.2 * S}" height="${12.2 * S}" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
      `<rect x="${px(-4.75)}" y="${pz(-5.5)}" width="${16 * S}" height="${11 * S}" fill="url(#sedum)" stroke="${INK}"/>` +
      `<rect x="${px(-10)}" y="${pz(-5.75)}" width="${5 * S}" height="${11.5 * S}" fill="#f2ede4" stroke="${INK}"/>` +
      label(3.2, 0, "CUBIERTA VERDE EXTENSIVA · pendiente 1.5 %") +
      label(-7.5, 0, "TERRAZA N2") +
      `<path d="M ${px(9)} ${pz(-2)} l 60 0 l -10 -6 m 10 6 l -10 6" stroke="${INK}" fill="none"/>` +
      `<circle cx="${px(11)}" cy="${pz(-5.2)}" r="7" fill="none" stroke="${INK}"/><text x="${px(10.5)}" y="${pz(-4.4)}" font-size="10" fill="${INK}">BALL</text>`,
  ),
  "det-01-celosia.svg": frame(
    "DET-01",
    "DETALLE CELOSÍA VERTICAL Y ALERO",
    "1:20",
    (() => {
      let s = "";
      for (let k = 0; k < 9; k++) s += `<rect x="${200 + k * 58}" y="200" width="24" height="420" fill="#1d5b3b"/>`;
      s += `<rect x="180" y="180" width="540" height="20" fill="#2b302f"/><rect x="180" y="620" width="540" height="20" fill="#2b302f"/>`;
      s += `<text x="180" y="680" font-size="12" fill="${INK}">Perfil aluminio 70 × 35 mm · pintura electrostática RAL 6005 · separación 170 mm</text>`;
      s += `<rect x="820" y="260" width="360" height="40" fill="#cfd8d2" stroke="${INK}"/><rect x="820" y="300" width="360" height="12" fill="#a77b55" stroke="${INK}"/>`;
      s += `<text x="820" y="340" font-size="12" fill="${INK}">Alero: listón teca 2" × 3" sobre perfilería galvanizada</text>`;
      return s;
    })(),
  ),
  "det-02-carpinteria.svg": frame(
    "DET-02",
    "DETALLE DE CARPINTERÍA Y BARANDAS",
    "1:10",
    (() => {
      let s = `<rect x="150" y="180" width="420" height="440" fill="#e3eeeb" stroke="${INK}" stroke-width="2"/><rect x="150" y="180" width="420" height="440" fill="none" stroke="#2b302f" stroke-width="10"/>`;
      s += `<line x1="360" y1="180" x2="360" y2="620" stroke="#2b302f" stroke-width="8"/>`;
      s += `<text x="150" y="660" font-size="12" fill="${INK}">Ventanería corrediza · aluminio negro mate · vidrio templado 8 mm</text>`;
      s += `<rect x="760" y="300" width="14" height="300" fill="#c9dcd8" stroke="${INK}"/><rect x="740" y="590" width="54" height="40" fill="#8f9792" stroke="${INK}"/>`;
      s += `<text x="700" y="660" font-size="12" fill="${INK}">Baranda vidrio laminado 10+10 mm · perfil base empotrado · h = 1.05 m</text>`;
      return s;
    })(),
  ),
};

for (const [name, svg] of Object.entries(files)) writeFileSync(join(OUT, name), svg);
console.log(`Generados ${Object.keys(files).length} planos en ${OUT}`);
