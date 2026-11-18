"use client";

import { ArrowRight, Box, Plus, TriangleAlert } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { QuoteStatus } from "@/types";
import { useUI } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useProjectData } from "@/hooks/useProjectData";
import { APPROVED_BUDGET, CURRENT_USER_ID, DEMO_BASE_DATE, expenses, materials, members, movements, projects } from "@/data/demo";
import { COST_CATEGORY_LABEL, STAGE_STATUS_LABEL, inventoryItems, quoteTotals } from "@/lib/domain";
import { cn, formatCOP, formatDate, formatNumber, formatPct } from "@/lib/format";
import { Drawer, Modal } from "@/components/ui/overlays";
import { Avatar, GlassButton, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { useFinance } from "@/components/dashboard/widgets";

const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  approved: { label: "Aprobada", tone: "success" },
  pending: { label: "Pendiente", tone: "warning" },
  draft: { label: "Borrador", tone: "neutral" },
  rejected: { label: "Rechazada", tone: "danger" },
};

function Table({ head, children, align = [] }: { head: string[]; children: ReactNode; align?: ("left" | "right")[] }) {
  return (
    <div className="overflow-x-auto rounded-[16px] ring-1 ring-line">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead className="bg-surface-2/70 text-[11px] tracking-wide text-ink-3 uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cn("px-4 py-2.5 font-medium", align[i] === "right" ? "text-right" : "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-line/70 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

/** Paneles de módulo abiertos desde la navegación principal. */
export function ModulePanels() {
  const activeModule = useUI((s) => s.module);
  const openModule = useUI((s) => s.openModule);
  const close = (v: boolean) => !v && openModule("home");

  return (
    <>
      <Drawer open={activeModule === "projects"} onOpenChange={close} title="Proyectos" description="Portafolio de RC Engineering · datos de demostración" width={640}>
        <ProjectsPanel />
      </Drawer>
      <Drawer open={activeModule === "quotes"} onOpenChange={close} title="Cotizaciones" description="Residencia RC-001" width={720}>
        <QuotesPanel />
      </Drawer>
      <Drawer open={activeModule === "materials"} onOpenChange={close} title="Materiales" description="Cantidades previstas, recibidas y consumidas" width={760}>
        <MaterialsPanel />
      </Drawer>
      <Drawer open={activeModule === "inventory"} onOpenChange={close} title="Inventario" description="Stock en bodega de obra y movimientos" width={720}>
        <InventoryPanel />
      </Drawer>
      <Drawer open={activeModule === "finance"} onOpenChange={close} title="Finanzas" description={`Corte al ${formatDate(DEMO_BASE_DATE)} · COP`} width={680}>
        <FinancePanel />
      </Drawer>
      <MaterialDetailModal />
      <ProjectDetailModal />
      <SettingsModal />
    </>
  );
}

function ProjectsPanel() {
  const { overall } = useProjectData();
  const toast = useUI((s) => s.toast);
  const openModule = useUI((s) => s.openModule);
  return (
    <ul className="space-y-3 px-6 pb-6">
      {projects.map((p) => (
        <li key={p.id} className="surface-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-brand">{p.code}</p>
              <p className="text-[15px] font-semibold text-ink">{p.name}</p>
              <p className="mt-0.5 text-[12px] text-ink-2">
                {p.city} · {p.type} · {formatNumber(p.builtAreaM2)} m² · {p.levels} niveles
              </p>
            </div>
            <StatusBadge tone={p.status === "active" ? "success" : "neutral"}>{p.status === "active" ? "Activo" : "En preparación"}</StatusBadge>
          </div>
          {p.hasDemoData ? (
            <div className="mt-3">
              <div className="flex justify-between text-[12px] text-ink-2">
                <span>Avance físico</span>
                <span className="tabular">{formatPct(overall)}</span>
              </div>
              <ProgressBar value={overall} className="mt-1.5" />
              <GlassButton variant="outline" size="sm" className="mt-3" trailing={<ArrowRight size={14} />} onClick={() => openModule("home")}>
                Abrir centro de control
              </GlassButton>
            </div>
          ) : (
            <button onClick={() => toast({ title: "Proyecto sin datos de demostración", description: "Conecta la API para cargar este proyecto.", tone: "info" })} className="mt-3 text-[12px] font-medium text-ink-3 underline-offset-2 hover:underline">
              Sin datos cargados en esta versión
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function QuotesPanel() {
  const quotes = useProjectStore((s) => s.quotes);
  const setQuick = useUI((s) => s.setQuickQuoteOpen);
  return (
    <div className="space-y-4 px-6 pb-6">
      <GlassButton variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setQuick(true)}>
        Crear cotización
      </GlassButton>
      <Table head={["Código", "Título", "Estado", "Total"]} align={["left", "left", "left", "right"]}>
        {quotes.map((q) => {
          const t = quoteTotals(q.items, q.adjustments);
          return (
            <tr key={q.id}>
              <td className="px-4 py-3 font-medium text-brand">{q.code}</td>
              <td className="px-4 py-3">
                <p className="text-ink">{q.title}</p>
                <p className="text-[12px] text-ink-3">
                  {q.clientName} · {formatDate(q.createdAt)} · {q.items.length} ítems
                  {q.adjustments.aiu.enabled ? " · AIU" : ""}
                  {q.adjustments.vat.enabled ? ` · IVA ${q.adjustments.vat.ratePct} %` : ""}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</StatusBadge>
              </td>
              <td className="px-4 py-3 text-right font-medium text-ink">{formatCOP(t.total)}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}

function MaterialsPanel() {
  const setDetail = useUI((s) => s.setMaterialDetailId);
  return (
    <div className="px-6 pb-6">
      <Table head={["Material", "Unidad", "Previsto", "Recibido", "Consumido", "Valor previsto"]} align={["left", "left", "right", "right", "right", "right"]}>
        {materials.map((m) => (
          <tr key={m.id} className="cursor-pointer hover:bg-surface-2/40" onClick={() => setDetail(m.id)}>
            <td className="px-4 py-3">
              <p className="font-medium text-ink">{m.name}</p>
              <p className="text-[12px] text-ink-3">{m.spec}</p>
            </td>
            <td className="px-4 py-3 text-ink-2">{m.unit}</td>
            <td className="px-4 py-3 text-right">{formatNumber(m.plannedQty)}</td>
            <td className="px-4 py-3 text-right">{formatNumber(m.receivedQty)}</td>
            <td className="px-4 py-3 text-right">{formatNumber(m.consumedQty)}</td>
            <td className="px-4 py-3 text-right">{formatCOP(m.plannedQty * m.unitPrice)}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-[12px] text-ink-3">El consumo es 0 porque la obra aún no inicia (Etapa 1 en proceso); el material recibido corresponde a compras anticipadas.</p>
    </div>
  );
}

function InventoryPanel() {
  const items = useMemo(() => inventoryItems(materials), []);
  const name = (id: string) => materials.find((m) => m.id === id)?.name ?? id;
  const unit = (id: string) => materials.find((m) => m.id === id)?.unit ?? "";
  return (
    <div className="space-y-5 px-6 pb-6">
      <Table head={["Referencia", "Stock", "Mínimo", "Estado"]} align={["left", "right", "right", "left"]}>
        {items.map((i) => (
          <tr key={i.materialId}>
            <td className="px-4 py-3 font-medium text-ink">{i.name}</td>
            <td className="px-4 py-3 text-right">
              {formatNumber(i.stock)} <span className="text-ink-3">{i.unit}</span>
            </td>
            <td className="px-4 py-3 text-right text-ink-2">{i.minStock ? formatNumber(i.minStock) : "—"}</td>
            <td className="px-4 py-3">
              {i.low ? (
                <StatusBadge tone="warning">
                  <TriangleAlert size={12} /> Stock bajo
                </StatusBadge>
              ) : i.minStock === 0 ? (
                <StatusBadge>Pedido por obra</StatusBadge>
              ) : (
                <StatusBadge tone="success">Disponible</StatusBadge>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink">Movimientos recientes</p>
        <Table head={["Fecha", "Material", "Tipo", "Cantidad", "Soporte"]} align={["left", "left", "left", "right", "left"]}>
          {[...movements].reverse().map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2.5 text-ink-2">{formatDate(m.date)}</td>
              <td className="px-4 py-2.5 text-ink">{name(m.materialId)}</td>
              <td className="px-4 py-2.5">
                <StatusBadge tone={m.type === "in" ? "success" : "info"}>{m.type === "in" ? "Entrada" : "Salida"}</StatusBadge>
              </td>
              <td className="px-4 py-2.5 text-right">
                {formatNumber(m.qty)} <span className="text-ink-3">{unit(m.materialId)}</span>
              </td>
              <td className="px-4 py-2.5 text-ink-2">{m.reference}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

function FinancePanel() {
  const f = useFinance();
  const { overall } = useProjectData();
  const byCat = useMemo(() => {
    const acc: Record<string, number> = {};
    expenses.forEach((e) => (acc[e.category] = (acc[e.category] ?? 0) + e.amount));
    return acc;
  }, []);
  return (
    <div className="space-y-5 px-6 pb-6">
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Presupuesto aprobado", formatCOP(APPROVED_BUDGET)],
          ["Valor ejecutado", formatCOP(f.executed)],
          ["Saldo disponible", formatCOP(f.available)],
          ["Planeado a la fecha", formatCOP(f.plannedToDate)],
        ].map(([l, v]) => (
          <div key={l} className="surface-card p-4">
            <p className="text-[12px] text-ink-2">{l}</p>
            <p className="tabular mt-1 text-[17px] font-semibold text-ink">{v}</p>
          </div>
        ))}
      </div>
      <div className="surface-card space-y-4 p-4">
        <div>
          <div className="flex justify-between text-[13px]">
            <span className="text-ink">Avance financiero (ejecutado / presupuesto)</span>
            <span className="tabular font-semibold">{formatPct(f.executionPct)}</span>
          </div>
          <ProgressBar value={f.executionPct} className="mt-2" />
        </div>
        <div>
          <div className="flex justify-between text-[13px]">
            <span className="text-ink">Avance físico de obra (ponderado por etapas)</span>
            <span className="tabular font-semibold">{formatPct(overall)}</span>
          </div>
          <ProgressBar value={overall} className="mt-2" />
        </div>
        <p className="text-[12px] text-ink-2">
          Desviación frente a lo planeado a la fecha: <strong className="tabular text-ink">{formatPct(f.deviationPct)}</strong>. Incluye compras anticipadas de acero, cemento y bloque.
        </p>
      </div>
      <Table head={["Fecha", "Concepto", "Categoría", "Valor"]} align={["left", "left", "left", "right"]}>
        {[...expenses].reverse().map((e) => (
          <tr key={e.id}>
            <td className="px-4 py-2.5 text-ink-2">{formatDate(e.date)}</td>
            <td className="px-4 py-2.5 text-ink">{e.concept}</td>
            <td className="px-4 py-2.5 text-ink-2">{COST_CATEGORY_LABEL[e.category]}</td>
            <td className="px-4 py-2.5 text-right">{formatCOP(e.amount)}</td>
          </tr>
        ))}
      </Table>
      <p className="text-[12px] text-ink-3">
        Por categoría: {Object.entries(byCat).map(([k, v]) => `${COST_CATEGORY_LABEL[k as keyof typeof COST_CATEGORY_LABEL]} ${formatCOP(v)}`).join(" · ")}
      </p>
    </div>
  );
}

function MaterialDetailModal() {
  const id = useUI((s) => s.materialDetailId);
  const setId = useUI((s) => s.setMaterialDetailId);
  const m = materials.find((x) => x.id === id);
  const inv = m ? inventoryItems([m])[0] : null;
  return (
    <Modal open={!!m} onOpenChange={(v) => !v && setId(null)} title={m?.name ?? ""} description={m ? `${m.spec} · ${m.supplier}` : ""} width={560}>
      {m && inv && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Previsto", m.plannedQty],
              ["Recibido", m.receivedQty],
              ["Consumido", m.consumedQty],
            ].map(([l, v]) => (
              <div key={l} className="rounded-[14px] bg-surface-2/70 p-3">
                <p className="text-[12px] text-ink-2">{l}</p>
                <p className="tabular mt-0.5 text-[16px] font-semibold text-ink">
                  {formatNumber(v as number)} <span className="text-[12px] font-normal text-ink-2">{m.unit}</span>
                </p>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-[13px]">
              <span>Recibido frente a previsto</span>
              <span className="tabular font-medium">{formatPct(m.receivedQty / m.plannedQty)}</span>
            </div>
            <ProgressBar value={m.receivedQty / m.plannedQty} className="mt-2" />
          </div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-2">Stock en bodega</dt>
              <dd className="tabular">
                {formatNumber(inv.stock)} {m.unit}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Stock mínimo</dt>
              <dd className="tabular">{m.minStock ? `${formatNumber(m.minStock)} ${m.unit}` : "Pedido según programación"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Precio unitario</dt>
              <dd className="tabular">
                {formatCOP(m.unitPrice)} / {m.unit}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Valor previsto</dt>
              <dd className="tabular font-medium">{formatCOP(m.plannedQty * m.unitPrice)}</dd>
            </div>
          </dl>
          {inv.low && (
            <p className="flex items-center gap-2 rounded-[12px] bg-warning-soft px-3 py-2 text-[12px] text-[#7c5314]">
              <TriangleAlert size={14} /> Stock por debajo del mínimo: programar abastecimiento.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function ProjectDetailModal() {
  const open = useUI((s) => s.projectDetailOpen);
  const setOpen = useUI((s) => s.setProjectDetailOpen);
  const openStage = useUI((s) => s.openStage);
  const { project, stages, progressByStage, overall } = useProjectData();
  const f = useFinance();
  return (
    <Modal open={open} onOpenChange={setOpen} title={project.name} description={`${project.code} · ${project.city}, ${project.country}`} width={680}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Área", `${formatNumber(project.builtAreaM2)} m²`],
            ["Niveles", String(project.levels)],
            ["Inicio", formatDate(project.startDate)],
            ["Entrega prevista", formatDate(project.plannedEndDate)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-[14px] bg-surface-2/70 p-3">
              <p className="text-[12px] text-ink-2">{l}</p>
              <p className="mt-0.5 text-[14px] font-semibold text-ink">{v}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">Avance por etapa</p>
          <ul className="space-y-2">
            {stages.map((s) => {
              const p = progressByStage[s.id];
              return (
                <li key={s.id}>
                  <button onClick={() => { setOpen(false); openStage(s.id); }} className="w-full rounded-[12px] px-3 py-2 text-left hover:bg-surface-2/70">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-ink">
                        Etapa {s.order} · {s.name} <span className="text-ink-3">({Math.round(s.weight * 100)} %)</span>
                      </span>
                      <span className="tabular text-ink-2">
                        {p.done}/{p.total} · {STAGE_STATUS_LABEL[p.status]}
                      </span>
                    </div>
                    <ProgressBar value={p.progress} className="mt-1.5" height={5} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-ink-2">
            Avance físico ponderado: <strong className="tabular text-ink">{formatPct(overall)}</strong> · Ejecución financiera: <strong className="tabular text-ink">{formatPct(f.executionPct)}</strong>
          </p>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">Equipo del proyecto</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 rounded-[12px] bg-surface-2/50 px-3 py-2">
                <Avatar initials={m.initials} size={30} />
                <span>
                  <span className="block text-[13px] font-medium text-ink">{m.name}</span>
                  <span className="block text-[11px] text-ink-2">{m.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal() {
  const open = useUI((s) => s.settingsOpen);
  const setOpen = useUI((s) => s.setSettingsOpen);
  const quality = useUI((s) => s.renderQuality);
  const setQuality = useUI((s) => s.setRenderQuality);
  const resetDemo = useProjectStore((s) => s.resetDemo);
  const toast = useUI((s) => s.toast);
  const me = members.find((m) => m.id === CURRENT_USER_ID)!;
  return (
    <Modal open={open} onOpenChange={setOpen} title="Configuración" description={`${me.name} · ${me.role}`} width={520}>
      <div className="space-y-5">
        <div>
          <p className="text-[13px] font-semibold text-ink">Calidad del visor 3D</p>
          <p className="text-[12px] text-ink-2">“Equilibrada” reduce la resolución y las sombras para equipos con menos recursos.</p>
          <div className="mt-2 flex rounded-full bg-surface-2 p-1">
            {(["high", "balanced"] as const).map((q) => (
              <button key={q} onClick={() => setQuality(q)} className={cn("h-8 flex-1 rounded-full text-[13px] font-medium", quality === q ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2")}>
                {q === "high" ? "Alta" : "Equilibrada"}
              </button>
            ))}
          </div>
        </div>
        <div className="hairline" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-ink">Datos de demostración</p>
            <p className="text-[12px] text-ink-2">Se guardan en este navegador. Restablecer borra actividades, notas y cotizaciones creadas.</p>
          </div>
          <GlassButton
            variant="danger"
            size="sm"
            onClick={() => {
              resetDemo();
              toast({ title: "Datos restablecidos", tone: "info" });
            }}
          >
            Restablecer
          </GlassButton>
        </div>
        <div className="flex items-center gap-2 rounded-[12px] bg-surface-2/60 px-3 py-2 text-[12px] text-ink-2">
          <Box size={14} /> Autenticación y permisos por proyecto se habilitarán al conectar el backend.
        </div>
      </div>
    </Modal>
  );
}
