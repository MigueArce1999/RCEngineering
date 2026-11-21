/**
 * Utilidades de planos y fotos: lectura de metadatos desde el nombre del archivo,
 * compresión de fotos y miniaturas (imágenes y primera página de PDF) en el navegador.
 */
import type { Blueprint } from "@/types";
import { asset } from "./asset";

export const BLUEPRINT_CATEGORIES: { value: Blueprint["category"]; label: string; prefix: string }[] = [
  { value: "architectural", label: "Arquitectónicos", prefix: "ARQ" },
  { value: "structural", label: "Estructurales", prefix: "EST" },
  { value: "electrical", label: "Eléctricos", prefix: "ELE" },
  { value: "plumbing", label: "Hidrosanitarios", prefix: "HID" },
  { value: "roof", label: "Cubiertas", prefix: "CUB" },
  { value: "details", label: "Detalles constructivos", prefix: "DET" },
];
export const CATEGORY_LABEL = Object.fromEntries(BLUEPRINT_CATEGORIES.map((c) => [c.value, c.label])) as Record<Blueprint["category"], string>;
export const BLUEPRINT_LEVELS = ["General", "N1", "N2", "N3", "Cubierta", "Sótano"];

export const ACCEPT_BLUEPRINTS = "application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp";
export const ACCEPT_PHOTOS = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const MAX_BLUEPRINT_MB = 50;

const CATEGORY_HINTS: [RegExp, Blueprint["category"]][] = [
  [/\b(arq|arquitect|planta|fachada|corte|seccion|sección)/i, "architectural"],
  [/\b(est|estruct|cimenta|column|viga|losa|zapata|refuerzo)/i, "structural"],
  [/\b(ele|electr|ilumina|tomas|tablero)/i, "electrical"],
  [/\b(hid|hidro|sanit|agua|desag|plomer)/i, "plumbing"],
  [/\b(cub|cubierta|techo)/i, "roof"],
  [/\b(det|detalle)/i, "details"],
];

/** Formato del plano según el tipo de archivo. */
export function blueprintFormat(file: File): Blueprint["format"] | null {
  const n = file.name.toLowerCase();
  if (file.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (file.type === "image/png" || n.endsWith(".png")) return "png";
  if (file.type === "image/jpeg" || /\.jpe?g$/.test(n)) return "jpg";
  if (file.type === "image/webp" || n.endsWith(".webp")) return "webp";
  return null;
}
export const FORMAT_MIME: Record<Blueprint["format"], string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

/**
 * Propone código, título, categoría, nivel y revisión a partir del nombre.
 * "EST-02 Planta de cimentación R1.pdf" → EST-02 · Planta de cimentación · Estructurales · R1
 */
export function guessBlueprintMeta(fileName: string, existingCodes: string[]) {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  // Código tipo "EST-02" / "ARQ 1"; se descartan "rev2", "nivel 1", "piso 2"
  const codeMatch = [...base.matchAll(/\b([A-Za-z]{2,4})[\s.-]?(\d{1,3})\b/g)].find((m) => !/^(rev|r|niv|n|piso)$/i.test(m[1])) ?? null;
  const revMatch = base.match(/\b(?:rev(?:isi[oó]n)?\.?\s*|r)(\d{1,2})\b/i);
  const levelMatch = base.match(/\b(?:nivel|piso|n)\s?(\d)\b/i);

  let category: Blueprint["category"] = "architectural";
  const byPrefix = codeMatch && BLUEPRINT_CATEGORIES.find((c) => c.prefix === codeMatch[1].toUpperCase());
  if (byPrefix) category = byPrefix.value;
  else for (const [re, c] of CATEGORY_HINTS) if (re.test(base)) { category = c; break; }

  const prefix = BLUEPRINT_CATEGORIES.find((c) => c.value === category)!.prefix;
  let code = codeMatch ? `${codeMatch[1].toUpperCase()}-${codeMatch[2].padStart(2, "0")}` : "";
  if (!code || existingCodes.includes(code)) {
    let n = 1;
    while (existingCodes.includes(`${prefix}-${String(n).padStart(2, "0")}`)) n++;
    code = `${prefix}-${String(n).padStart(2, "0")}`;
  }
  let title = base;
  if (codeMatch) title = title.replace(codeMatch[0], "");
  if (revMatch) title = title.replace(revMatch[0], "");
  title = title.replace(/^[\s·.-]+|[\s·.-]+$/g, "").replace(/\s{2,}/g, " ");
  title = title ? title.charAt(0).toUpperCase() + title.slice(1) : "Plano sin título";

  return {
    code,
    title,
    category,
    level: /cubierta|techo/i.test(base) ? "Cubierta" : levelMatch ? `N${levelMatch[1]}` : "General",
    revision: revMatch ? `R${revMatch[1]}` : "R0",
  };
}

export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

// ── Imágenes ────────────────────────────────────────────────────────────
function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", quality));
}

/** Redimensiona (respetando la orientación EXIF) y comprime a JPG. */
export async function resizeImage(source: Blob, maxSide: number, quality = 0.84) {
  const bmp = await createImageBitmap(source, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return { blob: await canvasToJpeg(canvas, quality), width: w, height: h };
}

/** Foto de obra: versión optimizada (2560 px) y miniatura (640 px). */
export async function preparePhoto(file: File) {
  const full = await resizeImage(file, 2560, 0.85);
  const thumb = await resizeImage(full.blob, 640, 0.8);
  return { full, thumb };
}

/** Fecha de la foto: la del archivo (las cámaras la conservan) o hoy. */
export function photoDate(file: File) {
  const d = file.lastModified ? new Date(file.lastModified) : new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// ── PDF ─────────────────────────────────────────────────────────────────
type PdfJs = typeof import("pdfjs-dist");
let pdfjs: Promise<PdfJs> | null = null;
export function loadPdfJs() {
  pdfjs ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = asset("/vendor/pdf.worker.min.mjs");
    return m;
  });
  return pdfjs;
}

/** Miniatura de la primera página de un PDF (y número de páginas). */
export async function pdfThumbnail(file: Blob, maxSide = 900) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = maxSide / Math.max(base.width, base.height);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas } as Parameters<typeof page.render>[0]).promise;
    return { blob: await canvasToJpeg(canvas, 0.82), pages: doc.numPages };
  } finally {
    void doc.destroy();
  }
}

/** Miniatura de cualquier plano (imagen o PDF). Si falla, el plano se sube igual sin miniatura. */
export async function blueprintThumbnail(file: File, format: Blueprint["format"]) {
  try {
    if (format === "pdf") return (await pdfThumbnail(file)).blob;
    return (await resizeImage(file, 900, 0.82)).blob;
  } catch {
    return null;
  }
}
