"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, FileText, Pencil, Image as ImageIcon, Layers3, Search, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Blueprint } from "@/types";
import { useProjectStore } from "@/stores/projectStore";
import { useDocs } from "@/stores/docsStore";
import { useCan } from "@/stores/authStore";
import { isRemote, supabase } from "@/lib/supabase";
import { BLUEPRINT_BUCKET } from "@/lib/docsApi";
import { ACCEPT_BLUEPRINTS, BLUEPRINT_CATEGORIES, BLUEPRINT_LEVELS, CATEGORY_LABEL, formatBytes } from "@/lib/docs";
import { asset } from "@/lib/asset";
import { cn, formatDate } from "@/lib/format";
import { GlassButton } from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";
import { PlanStage } from "./PlanStage";
import { useSignedUrls } from "./useSignedUrls";
import { ConfirmDelete, DropOverlay, EmptyDrop, InlineField, UploadRow, inputCls, useFileDrop } from "./shared";

/** Pestaña de planos: carga (arrastrar o elegir), clasificación, ficha editable y visor. */
export function BlueprintsTab({ initialId }: { initialId: string | null }) {
  const blueprints = useProjectStore((s) => s.blueprints);
  const jobs = useDocs((s) => s.jobs);
  const upload = useDocs((s) => s.uploadBlueprints);
  const canEdit = useCan("documents.manage") && isRemote;
  const fileInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Blueprint["category"] | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(initialId);

  const sorted = useMemo(() => [...blueprints].sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code, "es", { numeric: true })), [blueprints]);
  const q = query.trim().toLowerCase();
  const list = sorted.filter((b) => (category === "all" || b.category === category) && (!q || `${b.code} ${b.title} ${b.level} ${b.revision}`.toLowerCase().includes(q)));
  const counts = useMemo(() => Object.fromEntries(BLUEPRINT_CATEGORIES.map((c) => [c.value, blueprints.filter((b) => b.category === c.value).length])), [blueprints]);
  const doc = blueprints.find((b) => b.id === selected) ?? list[0] ?? null;
  const myJobs = jobs.filter((j) => j.kind === "blueprint" && j.stage !== "done");

  const thumbs = useSignedUrls(supabase, BLUEPRINT_BUCKET, blueprints.map((b) => b.thumbPath));
  const files = useSignedUrls(supabase, BLUEPRINT_BUCKET, [doc?.filePath]);
  const docUrl = doc ? (doc.filePath ? (files[doc.filePath] ?? null) : asset(doc.src)) : null;

  const onFiles = (fs: File[]) => {
    const before = new Set(useProjectStore.getState().blueprints.map((b) => b.id));
    void upload(fs).then(() => {
      const added = useProjectStore.getState().blueprints.find((b) => !before.has(b.id));
      if (added) setSelected(added.id);
    });
  };
  const drop = useFileDrop(onFiles, canEdit);
  const pick = () => fileInput.current?.click();

  const input = <input ref={fileInput} type="file" accept={ACCEPT_BLUEPRINTS} multiple hidden onChange={(e) => (onFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />;

  if (!blueprints.length && !myJobs.length)
    return (
      <div className="relative min-h-0 flex-1" {...drop.bind}>
        {input}
        <EmptyDrop
          icon={<Layers3 size={34} strokeWidth={1.5} />}
          title="Carga los planos del proyecto"
          action={
            canEdit ? (
              <GlassButton variant="primary" size="lg" icon={<Upload size={17} />} onClick={pick}>
                Elegir archivos
              </GlassButton>
            ) : undefined
          }
        >
          {canEdit ? (
            <>
              Arrastra aquí tus PDF o imágenes, varios a la vez (hasta 50 MB cada uno). Leemos el código, la revisión y la disciplina desde el nombre del archivo, por ejemplo <span className="font-medium text-ink">EST-02 Cimentación R1.pdf</span>.
            </>
          ) : (
            "Aún no hay planos cargados en este proyecto."
          )}
        </EmptyDrop>
        <DropOverlay show={drop.over} title="Suelta para cargar los planos" hint="PDF, JPG, PNG o WEBP" />
      </div>
    );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col md:flex-row" {...drop.bind}>
      {input}
      <aside className="anim-content flex max-h-[42%] shrink-0 flex-col border-b border-line/70 bg-surface-2/40 md:max-h-none md:w-[330px] md:border-r md:border-b-0">
        <div className="space-y-3 p-4">
          {canEdit && (
            <button onClick={pick} className="group flex w-full items-center gap-3 rounded-[16px] border border-dashed border-line-strong bg-white px-3.5 py-3 text-left transition hover:border-accent hover:bg-accent-soft/40">
              <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-brand text-white transition group-hover:scale-105">
                <Upload size={17} />
              </span>
              <span>
                <span className="block text-[13px] font-semibold text-ink">Cargar planos</span>
                <span className="block text-[11px] text-ink-2">o arrástralos aquí · PDF o imagen</span>
              </span>
            </button>
          )}
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por código o nombre" className={cn(inputCls, "h-9 pl-9 text-[13px]")} />
          </label>
          <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {(["all", ...BLUEPRINT_CATEGORIES.map((c) => c.value)] as const).map((c) => {
              const n = c === "all" ? blueprints.length : counts[c];
              if (c !== "all" && !n) return null;
              return (
                <button key={c} onClick={() => setCategory(c)} className={cn("h-7 shrink-0 rounded-full px-2.5 text-[12px] font-medium transition", category === c ? "bg-brand text-white" : "bg-white text-ink-2 ring-1 ring-line hover:text-ink")}>
                  {c === "all" ? "Todos" : CATEGORY_LABEL[c]} <span className="opacity-60">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="hairline" />
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          <AnimatePresence initial={false}>
            {myJobs.map((j) => (
              <div key={j.id} className="pb-1.5">
                <UploadRow job={j} />
              </div>
            ))}
          </AnimatePresence>
          <ul className="anim-stagger space-y-1">
            {list.map((b) => (
              <li key={b.id}>
                <button onClick={() => setSelected(b.id)} className={cn("flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition", b.id === doc?.id ? "bg-white shadow-[var(--shadow-sm)] ring-1 ring-line" : "hover:bg-white/70")}>
                  <Thumb src={b.thumbPath ? thumbs[b.thumbPath] : b.filePath ? null : asset(b.src)} format={b.format} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="tabular text-[12px] font-semibold text-brand">{b.code}</span>
                      <span className="text-[11px] text-ink-3">
                        {b.revision} · {b.format.toUpperCase()}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink">{b.title}</span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {CATEGORY_LABEL[b.category]} · {b.level}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!list.length && <li className="px-3 py-8 text-center text-[13px] text-ink-3">Sin planos para este filtro.</li>}
          </ul>
        </div>
      </aside>

      <section className="anim-content flex min-h-0 min-w-0 flex-1 flex-col">
        {doc ? (
          <>
            <DocHeader key={doc.id} doc={doc} canEdit={canEdit} url={docUrl} onDeleted={() => setSelected(null)} />
            <div className="relative min-h-[320px] flex-1">
              <AnimatePresence mode="wait">
                <motion.div key={doc.id} className="absolute inset-0" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}>
                  <PlanStage url={docUrl} format={doc.format} title={`${doc.code} · ${doc.title}`} />
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-[13px] text-ink-3">Selecciona un plano</div>
        )}
      </section>
      <DropOverlay show={drop.over} title="Suelta para cargar los planos" hint="Se clasifican solos según el nombre del archivo" />
    </div>
  );
}

function Thumb({ src, format }: { src: string | null | undefined; format: Blueprint["format"] }) {
  return (
    <span className="relative grid h-14 w-11 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-white ring-1 ring-line">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
      ) : format === "pdf" ? (
        <FileText size={16} className="text-ink-3" />
      ) : (
        <ImageIcon size={16} className="text-ink-3" />
      )}
      {format === "pdf" && <span className="absolute right-0.5 bottom-0.5 rounded-[4px] bg-danger px-1 text-[8px] leading-[13px] font-bold text-white">PDF</span>}
    </span>
  );
}

/** Ficha del plano: edición en línea (se guarda al salir de cada campo). */
function DocHeader({ doc, canEdit, url, onDeleted }: { doc: Blueprint; canEdit: boolean; url: string | null; onDeleted: () => void }) {
  const save = useDocs((s) => s.saveBlueprint);
  const remove = useDocs((s) => s.removeBlueprint);
  const [editing, setEditing] = useState(false);
  const levels = BLUEPRINT_LEVELS.includes(doc.level) ? BLUEPRINT_LEVELS : [doc.level, ...BLUEPRINT_LEVELS];

  const download = async () => {
    if (!url) return;
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = doc.fileName || `${doc.code} ${doc.title}.${doc.format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const summary = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold tracking-[-0.01em] text-ink">
          <span className="tabular text-brand">{doc.code}</span> · {doc.title}
        </p>
        <p className="text-[12px] text-ink-2">
          {CATEGORY_LABEL[doc.category]} · {doc.level} · {doc.revision}
        </p>
      </div>
      {canEdit && !doc.illustrative && (
        <GlassButton variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(true)} className="lg:hidden">
          Editar
        </GlassButton>
      )}
      {url && (
        <GlassButton variant="outline" size="sm" icon={<Download size={14} />} onClick={() => void download()} aria-label="Descargar">
          <span className="hidden sm:inline">Descargar</span>
        </GlassButton>
      )}
    </div>
  );

  return (
    <div className="border-b border-line/70 px-4 py-3 sm:px-5">
      {canEdit && !doc.illustrative ? (
        <>
        <div className={cn(editing ? "hidden" : "lg:hidden")}>{summary}</div>
        <div className={cn("gap-2 sm:grid-cols-[110px_1fr] lg:grid lg:grid-cols-[110px_minmax(180px,1fr)_180px_130px_80px_auto] lg:items-center", editing ? "grid" : "hidden")}>
          <InlineField value={doc.code} onCommit={(v) => save(doc.id, { code: v.toUpperCase() })} aria-label="Código" className="tabular h-9 font-semibold text-brand" maxLength={20} />
          <InlineField value={doc.title} onCommit={(v) => save(doc.id, { title: v })} aria-label="Título" className="h-9 font-medium" maxLength={160} />
          <Select size="sm" label="Disciplina" value={doc.category} onChange={(v) => save(doc.id, { category: v as Blueprint["category"] })} options={BLUEPRINT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
          <Select size="sm" label="Nivel" value={doc.level} onChange={(v) => save(doc.id, { level: v })} options={levels.map((l) => ({ value: l, label: l === "General" ? "General" : l.startsWith("N") ? `Nivel ${l.slice(1)}` : l }))} />
          <InlineField value={doc.revision} onCommit={(v) => save(doc.id, { revision: v.toUpperCase() })} aria-label="Revisión" className="h-9 text-center" maxLength={8} />
          <div className="flex items-center gap-1 sm:col-span-2 lg:col-span-1">
            <GlassButton variant="outline" size="sm" icon={<Download size={14} />} onClick={() => void download()} disabled={!url}>
              Descargar
            </GlassButton>
            <ConfirmDelete size="sm" onConfirm={() => void remove(doc.id).then((ok) => ok && onDeleted())} />
            {editing && (
              <GlassButton variant="primary" size="sm" className="ml-auto lg:hidden" onClick={() => setEditing(false)}>
                Listo
              </GlassButton>
            )}
          </div>
        </div>
        </>
      ) : (
        summary
      )}
      {!doc.illustrative && doc.uploadedAt && (
        <p className={cn("mt-2 text-[11px] text-ink-3", !editing && "max-lg:hidden")}>
          {doc.fileName} · {formatBytes(doc.fileSize ?? 0)} · cargado el {formatDate(doc.uploadedAt.slice(0, 10))}
        </p>
      )}
    </div>
  );
}
