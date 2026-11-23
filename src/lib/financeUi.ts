import type { CostCategory, Expense } from "@/types";

/** Paleta categórica validada (orden fijo; el color sigue a la categoría, nunca al rango) */
export const CAT_COLOR: Record<CostCategory, string> = { materials: "#1b7a50", labor: "#3b6fd4", equipment: "#d18a1f", other: "#9a5fc9" };
export const CATS: CostCategory[] = ["materials", "labor", "equipment", "other"];
/** Un gasto cuenta en el presupuesto salvo que se haya sacado expresamente */
export const counted = (e: Expense) => e.counts !== false;
