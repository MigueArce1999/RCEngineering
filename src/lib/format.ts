const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const copCompactFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const pctFormatter = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });

const millionsFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1, useGrouping: "always" } as Intl.NumberFormatOptions);
/** $ 1.720 M (millones de pesos) */
export const formatCOPMillions = (value: number) => `$ ${millionsFmt.format(value / 1_000_000)} M`;
export const formatCOP = (value: number) => copFormatter.format(Math.round(value));
export const formatCOPCompact = (value: number) => copCompactFormatter.format(value);
export const formatNumber = (value: number) => numberFormatter.format(value);
/** Recibe una fracción (0.35 → 35 %) */
export const formatPct = (fraction: number) => pctFormatter.format(Number.isFinite(fraction) ? fraction : 0);

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const formatDate = (iso: string) => dateFmt.format(parseISODate(iso));
export const formatShortDate = (iso: string) => shortDateFmt.format(parseISODate(iso));

export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "Hoy", "Mañana", "Vencida hace 3 días", "En 5 días" o la fecha corta. */
export function relativeDue(iso: string, now = new Date()) {
  const due = parseISODate(iso).getTime();
  const today = parseISODate(todayISO(now)).getTime();
  const days = Math.round((due - today) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days < 0) return `Vencida · ${formatShortDate(iso)}`;
  if (days <= 6) return `En ${days} días`;
  return formatShortDate(iso);
}

export function addDays(iso: string, days: number) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export const uid = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
