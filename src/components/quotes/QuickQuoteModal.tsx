"use client";

import { Eye, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { asset } from "@/lib/asset";
import { useMemo, useState } from "react";
import type { CostCategory, Quote, QuoteAdjustments, QuoteItem } from "@/types";
import { COST_CATEGORY_LABEL, itemSubtotal, quoteTotals } from "@/lib/domain";
import { cn, formatCOP, todayISO, uid } from "@/lib/format";
import { useUI } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useCatalog } from "@/hooks/useCatalog";
import { Modal } from "@/components/ui/overlays";
import { GlassButton } from "@/components/ui/primitives";

const UNITS: QuoteItem["unit"][] = ["und", "m²", "m³", "ml", "kg", "bulto 50 kg", "gl", "día", "mes"];

const emptyItem = (): QuoteItem => ({ id: uid("qi"), description: "", category: "materials", unit: "m²", quantity: 1, unitPrice: 0 });

const defaultAdj = (): QuoteAdjustments => ({
  discountPct: 0,
  aiu: { enabled: false, adminPct: 10, contingencyPct: 5, profitPct: 5 },
  vat: { enabled: false, ratePct: 19 },
});

const inputCls = "h-10 w-full rounded-[12px] border border-line bg-white px-3 text-[14px] text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";

export function QuickQuoteModal() {
  const open = useUI((s) => s.quickQuoteOpen);
  const setOpen = useUI((s) => s.setQuickQuoteOpen);
  // Montar el formulario solo al abrir garantiza un estado limpio en cada cotización
  return (
    <Modal open={open} onOpenChange={setOpen} title="Cotización rápida" description="Los valores se calculan automáticamente. Se guarda como borrador en este navegador." width={920} bodyClassName="p-0">
      {open && <QuoteForm onDone={() => setOpen(false)} />}
    </Modal>
  );
}

function QuoteForm({ onDone }: { onDone: () => void }) {
  const { projects } = useCatalog();
  const projectId = useProjectStore((s) => s.projectId);
  const quotes = useProjectStore((s) => s.quotes);
  const saveQuote = useProjectStore((s) => s.saveQuote);
  const toast = useUI((s) => s.toast);

  const [client, setClient] = useState("");
  const [project, setProject] = useState(projectId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  const [adj, setAdj] = useState<QuoteAdjustments>(defaultAdj);
  const [preview, setPreview] = useState(false);
  const [touched, setTouched] = useState(false);

  const totals = useMemo(() => quoteTotals(items, adj), [items, adj]);
  const code = `COT-${new Date().getFullYear()}-${String(quotes.length + 14 + 1).padStart(3, "0")}`;
  const validItems = items.filter((i) => i.description.trim() && i.quantity > 0);
  const errors = {
    client: !client.trim() ? "Ingresa el nombre del cliente" : "",
    items: validItems.length === 0 ? "Agrega al menos un ítem con descripción y cantidad" : "",
  };
  const valid = !errors.client && !errors.items;

  const update = (id: string, patch: Partial<QuoteItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const q: Quote = {
      id: uid("quo"),
      code,
      projectId: project,
      clientName: client.trim(),
      title: title.trim() || "Cotización rápida",
      description: description.trim(),
      status: "draft",
      createdAt: todayISO(),
      items: validItems,
      adjustments: adj,
      notes: notes.trim(),
    };
    if (!saveQuote(q)) return;
    toast({ title: "Borrador guardado", description: `${code} · ${formatCOP(totals.total)}` });
    onDone();
  };

  if (preview) return <QuotePreview {...{ code, client, project, title, description, notes, items: validItems, adj, onBack: () => setPreview(false), onSave: save }} />;

  return (
    <>
      <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del cliente" error={touched ? errors.client : ""}>
              <input className={inputCls} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Ej. Constructora del Caribe" />
            </Field>
            <Field label="Proyecto asociado">
              <Select label="Proyecto asociado" value={project} onChange={setProject} options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, hint: p.hasDemoData ? undefined : "Sin datos de demostración" }))} />
            </Field>
            <Field label="Título" className="sm:col-span-2">
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Muro de cerramiento perimetral" />
            </Field>
            <Field label="Descripción del trabajo" className="sm:col-span-2">
              <textarea className={cn(inputCls, "h-20 resize-none py-2")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Alcance, condiciones y exclusiones" />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">Ítems</p>
              {touched && errors.items && <p className="text-[12px] text-danger">{errors.items}</p>}
            </div>
            <ul className="space-y-2">
              {items.map((it, idx) => (
                <QuoteItemRow key={it.id} item={it} index={idx} onChange={(p) => update(it.id, p)} onRemove={items.length > 1 ? () => setItems((l) => l.filter((x) => x.id !== it.id)) : undefined} />
              ))}
            </ul>
            <GlassButton variant="outline" size="sm" className="mt-3" icon={<Plus size={15} />} onClick={() => setItems((l) => [...l, emptyItem()])}>
              Agregar ítem
            </GlassButton>
          </div>

          <Field label="Observaciones">
            <textarea className={cn(inputCls, "h-16 resize-none py-2")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Validez de la oferta, forma de pago…" />
          </Field>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-[18px] bg-surface-2/70 p-4">
            <p className="mb-3 text-[13px] font-semibold text-ink">Ajustes</p>
            <label className="flex items-center justify-between gap-3 text-[13px] text-ink-2">
              Descuento
              <PctInput value={adj.discountPct} onChange={(v) => setAdj((a) => ({ ...a, discountPct: v }))} label="Descuento" />
            </label>
            <div className="hairline my-3" />
            <Toggle label="AIU (Administración, Imprevistos, Utilidad)" checked={adj.aiu.enabled} onChange={(v) => setAdj((a) => ({ ...a, aiu: { ...a.aiu, enabled: v } }))} />
            {adj.aiu.enabled && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["adminPct", "A"],
                    ["contingencyPct", "I"],
                    ["profitPct", "U"],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className="text-[11px] text-ink-3">
                    {l} %
                    <PctInput value={adj.aiu[k]} onChange={(v) => setAdj((a) => ({ ...a, aiu: { ...a.aiu, [k]: v } }))} label={`${l} porcentaje`} />
                  </label>
                ))}
              </div>
            )}
            <div className="hairline my-3" />
            <Toggle label="IVA" checked={adj.vat.enabled} onChange={(v) => setAdj((a) => ({ ...a, vat: { ...a.vat, enabled: v } }))} />
            {adj.vat.enabled && (
              <label className="mt-2 flex items-center justify-between gap-3 text-[12px] text-ink-2">
                Tarifa
                <PctInput value={adj.vat.ratePct} onChange={(v) => setAdj((a) => ({ ...a, vat: { ...a.vat, ratePct: v } }))} label="Tarifa IVA" />
              </label>
            )}
            <p className="mt-3 text-[11px] leading-snug text-ink-3">Los impuestos son opcionales y configurables. Verifica el tratamiento tributario aplicable a cada contrato.</p>
          </div>
          <QuoteTotals totals={totals} adj={adj} />
        </aside>
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-line/70 bg-white/90 px-6 py-3.5 backdrop-blur">
        <span className="text-[12px] text-ink-3">{code}</span>
        <div className="ml-auto flex gap-2">
          <GlassButton variant="outline" icon={<Eye size={16} />} onClick={() => { setTouched(true); if (valid) setPreview(true); }}>
            Vista previa
          </GlassButton>
          <GlassButton variant="primary" icon={<Save size={16} />} onClick={save}>
            Guardar borrador
          </GlassButton>
        </div>
      </div>
    </>
  );
}

export function QuoteItemRow({ item, index, onChange, onRemove }: { item: QuoteItem; index: number; onChange: (p: Partial<QuoteItem>) => void; onRemove?: () => void }) {
  const n = index + 1;
  return (
    <li className="space-y-2 rounded-[16px] bg-surface-2/60 p-3">
      <div className="flex items-center gap-2">
        <span className="tabular w-5 shrink-0 text-center text-[12px] font-medium text-ink-3">{n}</span>
        <input className={inputCls} value={item.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Descripción del ítem" aria-label={`Descripción ítem ${n}`} />
        <button onClick={onRemove} disabled={!onRemove} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-danger-soft hover:text-danger disabled:opacity-30" aria-label={`Eliminar ítem ${n}`}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 pl-7 sm:grid-cols-[1.25fr_1fr_0.8fr_1.2fr]">
        <label className="text-[11px] text-ink-3">
          Categoría
          <Select size="md" className="mt-1 text-[13px]" label={`Categoría ítem ${n}`} value={item.category} onChange={(v) => onChange({ category: v as CostCategory })} options={(Object.keys(COST_CATEGORY_LABEL) as CostCategory[]).map((c) => ({ value: c, label: COST_CATEGORY_LABEL[c] }))} />
        </label>
        <label className="text-[11px] text-ink-3">
          Unidad
          <Select size="md" className="mt-1 text-[13px]" label={`Unidad ítem ${n}`} value={item.unit} onChange={(v) => onChange({ unit: v as QuoteItem["unit"] })} options={UNITS.map((u) => ({ value: u, label: u }))} />
        </label>
        <label className="text-[11px] text-ink-3">
          Cantidad
          <input className={cn(inputCls, "tabular mt-1 px-2")} type="number" min={0} step="any" value={item.quantity} onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value)) })} aria-label={`Cantidad ítem ${n}`} />
        </label>
        <label className="text-[11px] text-ink-3">
          Precio unitario (COP)
          <input className={cn(inputCls, "tabular mt-1 px-2")} type="number" min={0} step={100} value={item.unitPrice} onChange={(e) => onChange({ unitPrice: Math.max(0, Number(e.target.value)) })} aria-label={`Precio unitario ítem ${n}`} />
        </label>
      </div>
      <p className="flex justify-end gap-2 pl-7 text-[12px] text-ink-2">
        Subtotal <span className="tabular font-semibold text-ink">{formatCOP(itemSubtotal(item))}</span>
      </p>
    </li>
  );
}

export function QuoteTotals({ totals, adj }: { totals: ReturnType<typeof quoteTotals>; adj: QuoteAdjustments }) {
  const rows: [string, number, boolean?][] = [["Subtotal", totals.subtotal]];
  if (adj.discountPct > 0) rows.push([`Descuento (${adj.discountPct} %)`, -totals.discount]);
  if (adj.aiu.enabled) {
    rows.push([`Administración (${adj.aiu.adminPct} %)`, totals.admin]);
    rows.push([`Imprevistos (${adj.aiu.contingencyPct} %)`, totals.contingency]);
    rows.push([`Utilidad (${adj.aiu.profitPct} %)`, totals.profit]);
  }
  if (adj.vat.enabled) rows.push([`IVA ${adj.vat.ratePct} % ${totals.vatBaseLabel}`, totals.vat]);
  return (
    <div className="glass-brand rounded-[18px] p-4" aria-live="polite">
      <dl className="space-y-1.5 text-[13px]">
        {rows.map(([l, v]) => (
          <div key={l} className="flex justify-between gap-3 text-white/80">
            <dt>{l}</dt>
            <dd className="tabular text-white">{formatCOP(v)}</dd>
          </div>
        ))}
      </dl>
      <div className="my-3 h-px bg-white/15" />
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-white/80">Total</span>
        <span className="tabular text-[22px] font-semibold tracking-[-0.02em]">{formatCOP(totals.total)}</span>
      </div>
    </div>
  );
}

function QuotePreview(props: {
  code: string;
  client: string;
  project: string;
  title: string;
  description: string;
  notes: string;
  items: QuoteItem[];
  adj: QuoteAdjustments;
  onBack: () => void;
  onSave: () => void;
}) {
  const { projects } = useCatalog();
  const p = projects.find((x) => x.id === props.project);
  const totals = quoteTotals(props.items, props.adj);
  return (
    <>
      <div className="px-6 py-5">
        <article className="mx-auto max-w-[720px] rounded-[18px] bg-white p-8 shadow-[var(--shadow-md)] ring-1 ring-line">
          <header className="flex items-start justify-between gap-6">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/branding/rc-isotype.svg")} alt="RC" className="h-9" />
              <p className="mt-2 text-[12px] text-ink-2">RC Engineering &amp; Technology Group</p>
            </div>
            <div className="text-right">
              <p className="text-[18px] font-semibold text-ink">Cotización</p>
              <p className="tabular text-[13px] text-ink-2">{props.code}</p>
              <p className="text-[12px] text-ink-3">{new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}</p>
            </div>
          </header>
          <div className="mt-6 grid grid-cols-2 gap-4 text-[13px]">
            <div>
              <p className="text-ink-3">Cliente</p>
              <p className="font-medium text-ink">{props.client}</p>
            </div>
            <div>
              <p className="text-ink-3">Proyecto</p>
              <p className="font-medium text-ink">{p ? `${p.code} · ${p.name}` : "—"}</p>
            </div>
          </div>
          <h3 className="mt-5 text-[15px] font-semibold text-ink">{props.title || "Cotización rápida"}</h3>
          {props.description && <p className="mt-1 text-[13px] text-ink-2">{props.description}</p>}
          <table className="mt-4 w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-ink-3 uppercase">
                <th className="py-2 font-medium">Ítem</th>
                <th className="py-2 font-medium">Und</th>
                <th className="py-2 text-right font-medium">Cant.</th>
                <th className="py-2 text-right font-medium">V. unitario</th>
                <th className="py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {props.items.map((i) => (
                <tr key={i.id} className="border-b border-line/60">
                  <td className="py-2 text-ink">{i.description}</td>
                  <td className="py-2 text-ink-2">{i.unit}</td>
                  <td className="py-2 text-right">{i.quantity}</td>
                  <td className="py-2 text-right">{formatCOP(i.unitPrice)}</td>
                  <td className="py-2 text-right">{formatCOP(itemSubtotal(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 ml-auto max-w-[300px]">
            <QuoteTotals totals={totals} adj={props.adj} />
          </div>
          {props.notes && <p className="mt-4 text-[12px] text-ink-2">Observaciones: {props.notes}</p>}
        </article>
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t border-line/70 bg-white/90 px-6 py-3.5 backdrop-blur">
        <GlassButton variant="outline" icon={<Pencil size={16} />} onClick={props.onBack}>
          Editar
        </GlassButton>
        <GlassButton variant="primary" icon={<Save size={16} />} className="ml-auto" onClick={props.onSave}>
          Guardar borrador
        </GlassButton>
      </div>
    </>
  );
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-ink-2">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[12px] text-danger">{error}</span>}
    </label>
  );
}

function PctInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      max={100}
      step={0.5}
      value={value}
      onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value))))}
      aria-label={label}
      className="tabular h-9 w-20 rounded-[10px] border border-line bg-white px-2 text-right text-[13px] text-ink outline-none focus:border-accent"
    />
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="group flex w-full items-center justify-between gap-3 text-left text-[13px] text-ink-2 focus-visible:outline-none">
      {label}
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-focus-visible:ring-2 group-focus-visible:ring-accent/50 group-focus-visible:ring-offset-2", checked ? "bg-brand" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}
