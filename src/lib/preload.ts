"use client";

import { usePayroll } from "@/stores/payrollStore";
import { can } from "@/stores/authStore";

/**
 * Carga diferida de las pantallas secundarias: no pesan en la carga inicial del dashboard
 * y se precargan en segundo plano apenas el navegador queda libre, así abren al instante.
 */
export const loaders = {
  panels: () => import("@/components/modules/ModulePanels"),
  quote: () => import("@/components/quotes/QuickQuoteModal"),
  blueprints: () => import("@/components/viewer/BlueprintViewer"),
  search: () => import("@/components/layout/SearchCommand"),
  pdf: () => import("@/lib/payrollPdf"),
};

const idle = (fn: () => void, timeout = 1500) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else window.setTimeout(fn, 200);
};

let started = false;
/** Precarga código y datos de las pantallas cuando el dashboard ya está visible. */
export function preloadScreens() {
  if (started || typeof window === "undefined") return;
  started = true;
  idle(() => {
    void loaders.panels();
    void loaders.quote();
    void loaders.search();
    idle(() => {
      void loaders.blueprints();
      void loaders.pdf();
    });
  });
  // Datos de nómina: se piden poco después para no competir con el dashboard
  idle(() => void prefetchPayroll(), 2500);
}

/** Trae la nómina en segundo plano (solo si el rol puede verla). */
export function prefetchPayroll() {
  if (!can("payroll.manage")) return;
  const s = usePayroll.getState();
  if (s.state === "loading") return;
  return s.load();
}
