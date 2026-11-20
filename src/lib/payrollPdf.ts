/**
 * PDF de liquidación de nómina (carta horizontal). Se carga bajo demanda para no pesar en el Home.
 */
import type { PayrollEntry, PayrollPeriod, Worker } from "@/types";
import { KIND_LABEL, entrySubtotal, entryTotal, periodDays, periodSummary, periodTitle } from "./payroll";
import { formatCOP, formatDate, formatNumber } from "./format";
import { asset } from "./asset";

const BRAND: [number, number, number] = [6, 61, 50];
const INK: [number, number, number] = [16, 41, 31];
const MUTED: [number, number, number] = [99, 118, 105];
const LINE: [number, number, number] = [223, 231, 226];
const SOFT: [number, number, number] = [237, 242, 239];

/** Las fuentes estándar de PDF usan Latin-1: se normalizan espacios finos y signos fuera del juego. */
const t = (s: string) => s.replace(/[  ]/g, " ").replace(/[−–—]/g, "-").replace(/ /g, " ");
const money = (n: number) => t(formatCOP(n));

/** Convierte el isotipo SVG a PNG en alta resolución para incrustarlo. */
async function logoPng(): Promise<{ data: string; ratio: number } | null> {
  try {
    const svg = await (await fetch(asset("/branding/rc-isotype.svg"))).text();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error("logo"));
      img.src = url;
    });
    const w = 600;
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w) || 330;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return { data: c.toDataURL("image/png"), ratio: h / w };
  } catch {
    return null;
  }
}

export interface PayrollPdfInput {
  period: PayrollPeriod;
  entries: PayrollEntry[];
  workers: Worker[];
  project: { name: string; code: string; clientName?: string; city?: string };
  preparedBy?: string;
}

export async function downloadPayrollPdf({ period, entries, workers, project, preparedBy }: PayrollPdfInput) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), logoPng()]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const sum = periodSummary(entries);
  const paid = period.status === "paid";

  // ── Encabezado ──
  let x = M;
  if (logo) {
    const lw = 24;
    doc.addImage(logo.data, "PNG", M, 12, lw, lw * logo.ratio);
    x = M + lw + 5;
    doc.setDrawColor(...LINE);
    doc.line(x - 2.5, 12, x - 2.5, 12 + lw * logo.ratio);
  }
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RC Engineering &", x, 17);
  doc.text("Technology Group", x, 22);

  doc.setFontSize(17);
  doc.setTextColor(...BRAND);
  doc.text(t("Liquidación de nómina"), W - M, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const title = periodTitle(period);
  doc.text(t(title.charAt(0).toUpperCase() + title.slice(1)), W - M, 23, { align: "right" });

  // Estado
  const badge = paid ? `PAGADA · ${formatDate(period.paidAt ?? period.endDate)}` : "BORRADOR";
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  const bw = doc.getTextWidth(t(badge)) + 8;
  doc.setFillColor(...(paid ? ([223, 243, 233] as [number, number, number]) : ([251, 241, 225] as [number, number, number])));
  doc.roundedRect(W - M - bw, 26.5, bw, 6, 3, 3, "F");
  doc.setTextColor(...(paid ? ([19, 112, 74] as [number, number, number]) : ([148, 99, 26] as [number, number, number])));
  doc.text(t(badge), W - M - bw / 2, 30.6, { align: "center" });

  // Ficha del periodo
  const info: [string, string][] = [
    ["Proyecto", [project.code, project.name].filter(Boolean).join(" · ") || "-"],
    ["Cliente", project.clientName || "-"],
    ["Tipo", KIND_LABEL[period.kind]],
    ["Periodo", `${formatDate(period.startDate)} al ${formatDate(period.endDate)} (${periodDays(period)} días)`],
    ["Trabajadores", String(entries.length)],
    ["Generado", new Date().toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })],
  ];
  doc.setFillColor(...SOFT);
  doc.roundedRect(M, 38, W - 2 * M, 17, 2.5, 2.5, "F");
  const colW = (W - 2 * M) / 3;
  info.forEach(([k, v], i) => {
    const cx = M + 5 + (i % 3) * colW;
    const cy = 44 + Math.floor(i / 3) * 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(t(k.toUpperCase()), cx, cy);
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(t(v), cx + 24, cy, { maxWidth: colW - 30 });
  });

  // ── Tabla de liquidación ──
  const doc_ = (id: string | null) => workers.find((w) => w.id === id)?.document ?? "";
  autoTable(doc, {
    startY: 60,
    margin: { left: M, right: M },
    head: [["#", "Trabajador", "Cédula", "Cargo", "Días", "Valor día", "Subtotal", "Extras", "Descuentos", "Total a pagar"]],
    body: entries.map((e, i) => [
      String(i + 1),
      t(e.workerName),
      t(doc_(e.workerId)) || "-",
      t(e.role),
      t(formatNumber(e.days)),
      money(e.dailyRate),
      money(entrySubtotal(e)),
      e.extras ? money(e.extras) : "-",
      e.deductions ? `- ${money(e.deductions)}` : "-",
      money(entryTotal(e)),
    ]),
    foot: [["", "Totales", "", "", t(formatNumber(sum.days)), "", money(sum.subtotal), money(sum.extras), `- ${money(sum.deductions)}`, money(sum.total)]],
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.6, textColor: INK, cellPadding: { top: 2.4, bottom: 2.4, left: 2.2, right: 2.2 }, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, lineWidth: 0 },
    footStyles: { fillColor: SOFT, textColor: INK, fontStyle: "bold", lineWidth: 0 },
    alternateRowStyles: { fillColor: [250, 251, 250] },
    columnStyles: {
      0: { cellWidth: 8, textColor: MUTED },
      1: { cellWidth: 52, fontStyle: "bold" },
      2: { cellWidth: 26 },
      3: { cellWidth: 36 },
      4: { halign: "right", cellWidth: 14 },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right", fontStyle: "bold" },
    },
  });

  // ── Resumen por cargo y totales ──
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (y > 150) {
    doc.addPage();
    y = 20;
  }
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: W / 2 + 6 },
    head: [["Resumen por cargo", "Personas", "Días", "Total"]],
    body: sum.byRole.map((g) => [t(g.role), String(g.workers), t(formatNumber(g.days)), money(g.total)]),
    theme: "plain",
    styles: { fontSize: 8.4, textColor: INK, cellPadding: 2, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { textColor: MUTED, fontStyle: "bold", fontSize: 7.8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
  });

  const bx = W / 2 + 14;
  const bwid = W - M - bx;
  const rows: [string, string][] = [
    ["Días trabajados", t(formatNumber(sum.days))],
    ["Subtotal (días × valor día)", money(sum.subtotal)],
    ["Extras", `+ ${money(sum.extras)}`],
    ["Descuentos", `- ${money(sum.deductions)}`],
  ];
  doc.setFillColor(...SOFT);
  doc.roundedRect(bx, y, bwid, 46, 3, 3, "F");
  rows.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(t(k), bx + 6, y + 8 + i * 6);
    doc.setTextColor(...INK);
    doc.text(v, bx + bwid - 6, y + 8 + i * 6, { align: "right" });
  });
  doc.setFillColor(...BRAND);
  doc.roundedRect(bx, y + 32, bwid, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL A PAGAR", bx + 6, y + 40.6);
  doc.setFontSize(15);
  doc.text(money(sum.total), bx + bwid - 6, y + 41.2, { align: "right" });

  // ── Notas y firmas ──
  let ny = Math.max((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY, y + 46) + 9;
  if (ny > 175) {
    doc.addPage();
    ny = 22;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  doc.text(t("Total por trabajador = días trabajados × valor día + extras - descuentos. No incluye aportes a seguridad social ni prestaciones sociales."), M, ny);
  if (!paid) doc.text(t("Documento en borrador: no constituye soporte de pago."), M, ny + 4.5);

  const sy = ny + 22;
  const labels = [`Elaboró${preparedBy ? `: ${preparedBy}` : ""}`, "Revisó", "Aprobó"];
  const sw = (W - 2 * M - 20) / 3;
  labels.forEach((l, i) => {
    const sx = M + i * (sw + 10);
    doc.setDrawColor(...MUTED);
    doc.line(sx, sy, sx + sw, sy);
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(t(l), sx, sy + 5, { maxWidth: sw });
  });

  // ── Pie de página ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(t(["RC Engineering OS", project.code, title].filter(Boolean).join(" · ")), M, H - 8);
    doc.text(t(`Página ${i} de ${pages}`), W - M, H - 8, { align: "right" });
  }

  doc.save(`nomina-${project.code || "proyecto"}-${period.startDate}-${period.kind === "monthly" ? "mensual" : "quincenal"}.pdf`);
}
