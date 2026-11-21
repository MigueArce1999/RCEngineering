"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useDocs } from "@/stores/docsStore";
import { useCan } from "@/stores/authStore";
import { isRemote, supabase } from "@/lib/supabase";
import { PHOTO_BUCKET } from "@/lib/docsApi";
import { ACCEPT_PHOTOS } from "@/lib/docs";
import { cn, formatDate, parseISODate } from "@/lib/format";
import { GlassButton, Skeleton } from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";
import { Lightbox, type LightboxItem } from "./Lightbox";
import { useSignedUrls } from "./useSignedUrls";
import { ConfirmDelete, DropOverlay, EmptyDrop, useFileDrop } from "./shared";

/** Valor de "Sin etapa" (el selector no admite cadenas vacías) */
const NONE = "__none__";
const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });

/** Registro fotográfico de la obra, agrupado por mes y etiquetado por etapa. */
export function PhotosTab() {
  const photos = useDocs((s) => s.photos);
  const state = useDocs((s) => s.photosState);
  const jobs = useDocs((s) => s.jobs);
  const load = useDocs((s) => s.loadPhotos);
  const upload = useDocs((s) => s.uploadPhotos);
  const stages = useProjectStore((s) => s.stages);
  const canEdit = useCan("documents.manage") && isRemote;
  const fileInput = useRef<HTMLInputElement>(null);
  const [stageId, setStageId] = useState<string>(NONE);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const stageName = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s.name])), [stages]);
  const thumbs = useSignedUrls(supabase, PHOTO_BUCKET, photos.map((p) => p.thumbPath));
  // Fotos completas: solo la abierta y sus vecinas
  const fullPaths = useMemo(() => (open === null ? [] : [-1, 0, 1].map((d) => photos[(open + d + photos.length) % photos.length]?.filePath)), [open, photos]);
  const fulls = useSignedUrls(supabase, PHOTO_BUCKET, fullPaths);

  const items: LightboxItem[] = photos.map((p) => ({ id: p.id, src: fulls[p.filePath], thumb: thumbs[p.thumbPath], caption: p.caption, takenAt: p.takenAt, stage: p.stageId ? stageName[p.stageId] : undefined }));
  const groups = useMemo(() => {
    const g: { key: string; label: string; items: { idx: number }[] }[] = [];
    photos.forEach((p, idx) => {
      const key = p.takenAt.slice(0, 7);
      let grp = g.find((x) => x.key === key);
      if (!grp) g.push((grp = { key, label: monthFmt.format(parseISODate(`${key}-01`)), items: [] }));
      grp.items.push({ idx });
    });
    return g;
  }, [photos]);

  const myJobs = jobs.filter((j) => j.kind === "photo" && j.stage !== "done");
  const onFiles = (fs: File[]) => void upload(fs, stageId === NONE ? null : stageId);
  const drop = useFileDrop(onFiles, canEdit);
  const input = <input ref={fileInput} type="file" accept={ACCEPT_PHOTOS} multiple hidden onChange={(e) => (onFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />;
  const stageOptions = [{ value: NONE, label: "Sin etapa" }, ...stages.map((s) => ({ value: s.id, label: s.name }))];

  if (state === "error" && !photos.length)
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <p className="text-[14px] text-ink-2">No se pudieron cargar las fotos.</p>
          <GlassButton variant="outline" size="md" className="mt-3" onClick={() => void load()}>
            Reintentar
          </GlassButton>
        </div>
      </div>
    );
  if (state !== "ready" && !photos.length)
    return (
      <div className="grid flex-1 grid-cols-2 gap-3 p-6 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-[16px]" />
        ))}
      </div>
    );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" {...drop.bind}>
      {input}
      {(photos.length > 0 || myJobs.length > 0) && canEdit && (
        <div className="anim-content flex flex-wrap items-center gap-2 border-b border-line/70 px-4 py-3 sm:px-6">
          <GlassButton variant="primary" size="md" icon={<ImagePlus size={16} />} onClick={() => fileInput.current?.click()}>
            Subir fotos
          </GlassButton>
          <span className="text-[12px] text-ink-2">a la etapa</span>
          <div className="w-[220px]">
            <Select size="sm" label="Etapa de las fotos" value={stageId} onChange={setStageId} options={stageOptions} />
          </div>
          <span className="ml-auto text-[12px] text-ink-3">
            {photos.length} {photos.length === 1 ? "foto" : "fotos"} · arrastra para agregar más
          </span>
        </div>
      )}

      {!photos.length && !myJobs.length ? (
        <EmptyDrop
          icon={<Camera size={34} strokeWidth={1.5} />}
          title="Registro fotográfico de la obra"
          action={
            canEdit ? (
              <GlassButton variant="primary" size="lg" icon={<ImagePlus size={17} />} onClick={() => fileInput.current?.click()}>
                Subir fotos
              </GlassButton>
            ) : undefined
          }
        >
          {canEdit
            ? "Sube las fotos del avance: se optimizan solas, se ordenan por fecha y tus invitados podrán compararlas con el modelo 3D."
            : "Aún no hay fotos de la obra."}
        </EmptyDrop>
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <AnimatePresence>
            {myJobs.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {myJobs.map((j) => (
                  <div key={j.id} className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {j.preview && <img src={j.preview} alt="" className={cn("h-full w-full object-cover transition duration-500", j.stage === "error" ? "opacity-40 grayscale" : "opacity-70")} />}
                    <ProgressRing value={j.stage === "error" ? 0 : j.progress} error={j.stage === "error"} />
                    {j.error && <span className="absolute inset-x-2 bottom-2 rounded-md bg-danger px-2 py-1 text-[11px] text-white">{j.error}</span>}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {groups.map((g) => (
            <section key={g.key} className="mb-7">
              <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-ink-2 uppercase first-letter:uppercase">{g.label}</h3>
              <div className="anim-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {g.items.map(({ idx }) => {
                  const p = photos[idx];
                  return (
                    <button key={p.id} onClick={() => setOpen(idx)} className="group relative aspect-[4/3] overflow-hidden rounded-[16px] bg-surface-2 text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {thumbs[p.thumbPath] && <img src={thumbs[p.thumbPath]} alt={p.caption || "Foto de obra"} loading="lazy" className="h-full w-full object-cover transition duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]" />}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pt-8 pb-2.5 text-white">
                        <span className="block truncate text-[12px] font-medium">{p.caption || (p.stageId ? stageName[p.stageId] : "Sin descripción")}</span>
                        <span className="block text-[11px] opacity-75">{formatDate(p.takenAt)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} details={canEdit ? (it) => <PhotoEditor key={it.id} id={it.id} stageOptions={stageOptions} onDeleted={() => setOpen(null)} /> : undefined} />
      <DropOverlay show={drop.over} title="Suelta para subir las fotos" hint="Se optimizan y ordenan por fecha automáticamente" />
    </div>
  );
}

function ProgressRing({ value, error }: { value: number; error: boolean }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" width="48" height="48" viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r={r} fill="rgb(0 0 0 / 0.35)" stroke="rgb(255 255 255 / 0.35)" strokeWidth="4" />
      <motion.circle cx="24" cy="24" r={r} fill="none" stroke={error ? "#e5484d" : "#fff"} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} transform="rotate(-90 24 24)" animate={{ strokeDashoffset: c * (1 - Math.max(0.04, value)) }} transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.4 }} />
    </svg>
  );
}

/** Pie de foto editable dentro del visor (descripción, fecha y etapa). */
function PhotoEditor({ id, stageOptions, onDeleted }: { id: string; stageOptions: { value: string; label: string }[]; onDeleted: () => void }) {
  const photo = useDocs((s) => s.photos.find((p) => p.id === id));
  const save = useDocs((s) => s.savePhoto);
  const remove = useDocs((s) => s.removePhoto);
  const [caption, setCaption] = useState(photo?.caption ?? "");
  if (!photo) return null;
  const dark = "h-9 rounded-full border border-white/15 bg-white/10 px-3.5 text-[13px] text-white outline-none placeholder:text-white/45 focus:border-white/40";
  return (
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2">
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={() => caption.trim() !== photo.caption && save(id, { caption: caption.trim() })}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="Describe la foto (p. ej. Fundida de placa nivel 2)"
        maxLength={280}
        className={cn(dark, "min-w-[240px] flex-1")}
      />
      <input type="date" value={photo.takenAt} onChange={(e) => e.target.value && save(id, { takenAt: e.target.value })} className={cn(dark, "[color-scheme:dark]")} aria-label="Fecha de la foto" />
      <div className="w-[200px] [&_button]:border-white/15 [&_button]:bg-white/10 [&_button]:text-white">
        <Select size="sm" label="Etapa" value={photo.stageId ?? NONE} onChange={(v) => save(id, { stageId: v === NONE ? null : v })} options={stageOptions} />
      </div>
      <ConfirmDelete size="sm" className="text-white/70 hover:bg-white/10" onConfirm={() => void remove(id).then((ok) => ok && onDeleted())} />
    </div>
  );
}
