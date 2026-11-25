"use client";

import { ArrowDownToLine, ArrowUpFromLine, Minus, PackagePlus, Plus, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { InventoryItem, MaterialUnit } from "@/types";
import { useCatalog } from "@/hooks/useCatalog";
import { useProjectStore } from "@/stores/projectStore";
import { useUI } from "@/stores/uiStore";
import { can } from "@/stores/authStore";
import { inventoryItems } from "@/lib/domain";
import { cn, formatDate, formatNumber, todayISO } from "@/lib/format";
import { Modal } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/primitives";

const UNITS: MaterialUnit[] = ["und", "kg", "m³", "m²", "ml", "bulto 50 kg"];
const FIELD = "w-full rounded-[12px] bg-surface-2 px-3.5 text-[16px] text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand h-12";

type Sheet = { kind: "add" } | { kind: "move"; item: InventoryItem; type: "in" | "out" } | null;

export function InventoryPanel() {
  const { materials, movements } = useCatalog();
  const items = useMemo(() => inventoryItems(materials), [materials]);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "low">("all");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [showAll, setShowAll] = useState(false);
  const canEdit = can("inventory.manage");
  const lowCount = items.filter((i) => i.low).length;
  const spec = (id: string) => materials.find((m) => m.id === id)?.spec ?? "";
  const list = items.filter((i) => (only === "all" || i.low) && i.name.toLowerCase().includes(q.trim().toLowerCase()));
  const moves = useMemo(() => [...movements].reverse(), [movements]);
  const name = (id: string) => materials.find((m) => m.id === id)?.name ?? id;
  const unit = (id: string) => materials.find((m) => m.id === id)?.unit ?? "";

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-4 pt-1 pb-28 sm:px-6">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[16px] bg-surface-2 px-4 py-3">
            <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] text-ink">{items.length}</p>
            <p className="mt-1 text-[12.5px] text-ink-2">Referencias en bodega</p>
          </div>
          <button type="button" onClick={() => setOnly(only === "low" ? "all" : "low")} className={cn("rounded-[16px] px-4 py-3 text-left transition", lowCount ? "bg-[#fbf0dc] text-[#7a4b0a]" : "bg-surface-2 text-ink")}>
            <p className="text-[26px] leading-none font-semibold tracking-[-0.02em]">{lowCount}</p>
            <p className="mt-1 text-[12.5px] opacity-80">{lowCount ? "Con stock bajo · tocar para ver" : "Con stock bajo"}</p>
          </button>
        </div>

        {items.length > 4 && (
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar material" className={cn(FIELD, "pl-10")} />
          </div>
        )}
        {only === "low" && (
          <button type="button" onClick={() => setOnly("all")} className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-medium text-ink">
            Solo stock bajo ✕
          </button>
        )}

        <section aria-label="Materiales" className="space-y-2.5">
          {list.map((i) => (
            <Card key={i.materialId} item={i} spec={spec(i.materialId)} canEdit={canEdit} onMove={(type) => setSheet({ kind: "move", item: i, type })} />
          ))}
          {!list.length && (
            <div className="rounded-[16px] border border-dashed border-line px-4 py-8 text-center">
              <p className="text-[14px] font-medium text-ink">{items.length ? "No hay materiales con ese filtro" : "Aún no hay materiales"}</p>
              {canEdit && !items.length && <p className="mt-1 text-[13px] text-ink-2">Toca “Agregar material” para empezar.</p>}
            </div>
          )}
        </section>

        <section aria-label="Movimientos recientes">
          <p className="mb-2 text-[13px] font-semibold text-ink">Movimientos recientes</p>
          <ul className="divide-y divide-line/70 overflow-hidden rounded-[16px] ring-1 ring-line">
            {(showAll ? moves : moves.slice(0, 8)).map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3.5 py-3">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", m.type === "in" ? "bg-[#e3f4ea] text-[#176a3f]" : "bg-[#e6eefb] text-[#274f9c]")}>
                  {m.type === "in" ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{name(m.materialId)}</p>
                  <p className="truncate text-[12px] text-ink-2">
                    {formatDate(m.date)}
                    {m.reference ? ` · ${m.reference}` : ""}
                  </p>
                </div>
                <p className={cn("shrink-0 text-[15px] font-semibold tabular-nums", m.type === "in" ? "text-[#176a3f]" : "text-[#274f9c]")}>
                  {m.type === "in" ? "+" : "−"}
                  {formatNumber(m.qty)} <span className="text-[12px] font-normal text-ink-3">{unit(m.materialId)}</span>
                </p>
              </li>
            ))}
            {!moves.length && <li className="px-4 py-6 text-center text-[13px] text-ink-2">Sin movimientos todavía.</li>}
          </ul>
          {moves.length > 8 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 h-11 w-full rounded-full text-[13px] font-medium text-brand">
              {showAll ? "Ver menos" : `Ver los ${moves.length} movimientos`}
            </button>
          )}
        </section>
      </div>

      {canEdit && (
        <div className="sticky bottom-0 z-10 border-t border-line/70 bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
          <button type="button" onClick={() => setSheet({ kind: "add" })} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-[16px] font-semibold text-white shadow-[var(--shadow-md)] active:scale-[.99]">
            <PackagePlus size={20} /> Agregar material
          </button>
        </div>
      )}

      {sheet?.kind === "add" && <AddSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === "move" && <MoveSheet item={sheet.item} type={sheet.type} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Card({ item, spec, canEdit, onMove }: { item: InventoryItem; spec: string; canEdit: boolean; onMove: (t: "in" | "out") => void }) {
  const pct = item.minStock > 0 ? Math.min(100, (item.stock / (item.minStock * 2)) * 100) : null;
  return (
    <article className="rounded-[18px] p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15.5px] leading-snug font-semibold text-ink">{item.name}</h3>
          {spec && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-2">{spec}</p>}
        </div>
        {item.low ? (
          <StatusBadge tone="warning">
            <TriangleAlert size={12} /> Bajo
          </StatusBadge>
        ) : (
          <StatusBadge tone="success">Disponible</StatusBadge>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-[34px] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">
          {formatNumber(item.stock)} <span className="text-[14px] font-normal tracking-normal text-ink-3">{item.unit}</span>
        </p>
        <p className="pb-1 text-[12.5px] text-ink-2">{item.minStock ? `Mínimo ${formatNumber(item.minStock)}` : "Sin mínimo"}</p>
      </div>
      {pct !== null && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className={cn("h-full rounded-full", item.low ? "bg-[#d99a2b]" : "bg-brand")} style={{ width: `${pct}%` }} />
        </div>
      )}
      {canEdit && (
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onMove("in")} className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#e3f4ea] text-[14px] font-semibold text-[#176a3f] active:scale-[.98]">
            <Plus size={16} /> Entrada
          </button>
          <button type="button" onClick={() => onMove("out")} className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#e6eefb] text-[14px] font-semibold text-[#274f9c] active:scale-[.98]">
            <Minus size={16} /> Salida
          </button>
        </div>
      )}
    </article>
  );
}

function MoveSheet({ item, type, onClose }: { item: InventoryItem; type: "in" | "out"; onClose: () => void }) {
  const addMovement = useProjectStore((s) => s.addMovement);
  const [qty, setQty] = useState(0);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const isIn = type === "in";
  const over = !isIn && qty > item.stock;
  const steps = isIn ? [1, 5, 10, 50] : [1, 2, 5, 10];
  const save = async () => {
    if (qty <= 0 || busy) return;
    setBusy(true);
    const ok = await addMovement({ materialId: item.materialId, type, qty, date: todayISO(), reference: ref.trim() || (isIn ? "Entrada a bodega" : "Salida a obra") });
    setBusy(false);
    if (ok) {
      useUI.getState().toast({ title: isIn ? "Entrada registrada" : "Salida registrada", description: `${formatNumber(qty)} ${item.unit} · ${item.name}`, tone: "success" });
      onClose();
    }
  };
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      width={460}
      title={isIn ? "Registrar entrada" : "Registrar salida"}
      description={`${item.name} · en bodega ${formatNumber(item.stock)} ${item.unit}`}
      footer={
        <button type="button" disabled={qty <= 0 || busy} onClick={save} className="h-14 w-full rounded-full bg-brand text-[16px] font-semibold text-white disabled:opacity-40">
          {busy ? "Guardando…" : qty > 0 ? `${isIn ? "Sumar" : "Restar"} ${formatNumber(qty)} ${item.unit}` : "Indica la cantidad"}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Menos" onClick={() => setQty(Math.max(0, qty - 1))} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface-2 text-ink active:scale-95">
            <Minus size={22} />
          </button>
          <input inputMode="decimal" value={qty || ""} placeholder="0" onChange={(e) => setQty(Math.max(0, Number(e.target.value.replace(",", ".")) || 0))} className="h-14 min-w-0 flex-1 rounded-[14px] bg-surface-2 text-center text-[28px] font-semibold text-ink tabular-nums outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" aria-label="Cantidad" />
          <button type="button" aria-label="Más" onClick={() => setQty(qty + 1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface-2 text-ink active:scale-95">
            <Plus size={22} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {steps.map((n) => (
            <button key={n} type="button" onClick={() => setQty(qty + n)} className="h-10 rounded-full bg-surface-2 px-4 text-[14px] font-medium text-ink active:scale-95">
              +{n}
            </button>
          ))}
          {!isIn && item.stock > 0 && (
            <button type="button" onClick={() => setQty(item.stock)} className="h-10 rounded-full bg-surface-2 px-4 text-[14px] font-medium text-ink">
              Todo
            </button>
          )}
        </div>
        {over && <p className="rounded-[12px] bg-[#fbf0dc] px-3 py-2 text-[13px] text-[#7a4b0a]">Estás sacando más de lo que hay en bodega ({formatNumber(item.stock)} {item.unit}).</p>}
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">{isIn ? "Proveedor o remisión (opcional)" : "Destino o actividad (opcional)"}</span>
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={isIn ? "Ej. Remisión 2041" : "Ej. Piso 2, baño"} className={FIELD} />
        </label>
      </div>
    </Modal>
  );
}

function AddSheet({ onClose }: { onClose: () => void }) {
  const addMaterial = useProjectStore((s) => s.addMaterial);
  const [f, setF] = useState({ name: "", unit: "und" as MaterialUnit, received: 0, minStock: 0, spec: "", supplier: "", plannedQty: 0, unitPrice: 0 });
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);
  const save = async () => {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    const ok = await addMaterial({ name: f.name.trim(), spec: f.spec.trim(), unit: f.unit, plannedQty: f.plannedQty, unitPrice: f.unitPrice, minStock: f.minStock, supplier: f.supplier.trim() }, f.received);
    setBusy(false);
    if (ok) {
      useUI.getState().toast({ title: "Material agregado", description: f.name.trim(), tone: "success" });
      onClose();
    }
  };
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      width={480}
      title="Agregar material"
      description="Lo básico primero; el resto es opcional."
      footer={
        <button type="button" disabled={!f.name.trim() || busy} onClick={save} className="h-14 w-full rounded-full bg-brand text-[16px] font-semibold text-white disabled:opacity-40">
          {busy ? "Guardando…" : "Guardar material"}
        </button>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">¿Qué material es?</span>
          <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Cemento gris, Varilla 1/2”" className={FIELD} />
        </label>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Se cuenta en</span>
          <div className="flex flex-wrap gap-2">
            {UNITS.map((u) => (
              <button key={u} type="button" onClick={() => set("unit", u)} className={cn("h-11 rounded-full px-4 text-[14px] font-medium", f.unit === u ? "bg-brand text-white" : "bg-surface-2 text-ink")}>
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Cantidad que hay hoy</span>
            <input inputMode="decimal" value={f.received || ""} placeholder="0" onChange={(e) => set("received", num(e.target.value))} className={FIELD} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">Avisar si baja de</span>
            <input inputMode="decimal" value={f.minStock || ""} placeholder="0" onChange={(e) => set("minStock", num(e.target.value))} className={FIELD} />
          </label>
        </div>
        <button type="button" onClick={() => setMore(!more)} className="h-11 text-[14px] font-medium text-brand">
          {more ? "Ocultar detalles" : "Más detalles (proveedor, precio, previsto)"}
        </button>
        {more && (
          <div className="space-y-3">
            <input value={f.spec} onChange={(e) => set("spec", e.target.value)} placeholder="Especificación (marca, medida)" className={FIELD} />
            <input value={f.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Proveedor" className={FIELD} />
            <div className="grid grid-cols-2 gap-3">
              <input inputMode="decimal" value={f.plannedQty || ""} onChange={(e) => set("plannedQty", num(e.target.value))} placeholder="Cantidad prevista" className={FIELD} />
              <input inputMode="numeric" value={f.unitPrice || ""} onChange={(e) => set("unitPrice", num(e.target.value))} placeholder="Precio unitario" className={FIELD} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
