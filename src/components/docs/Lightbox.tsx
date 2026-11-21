"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Box, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cn, formatDate } from "@/lib/format";

export interface LightboxItem {
  id: string;
  src: string | undefined;
  thumb: string | undefined;
  caption: string;
  takenAt: string;
  stage?: string;
}

/**
 * Visor de fotos a pantalla completa: deslizar, flechas del teclado y tira de miniaturas.
 * `side` permite mostrar algo junto a la foto (p. ej. el modelo 3D para comparar).
 * `details` reemplaza el pie de foto (edición en la app).
 */
export function Lightbox({
  items,
  index,
  onIndex,
  onClose,
  details,
  side,
  sideLabel = "Comparar con el modelo 3D",
}: {
  items: LightboxItem[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  details?: (item: LightboxItem) => ReactNode;
  side?: ReactNode;
  sideLabel?: string;
}) {
  const open = index !== null && !!items[index];
  const item = open ? items[index] : null;
  const [dir, setDir] = useState(0);
  const [compare, setCompare] = useState(false);

  const go = useCallback(
    (d: number) => {
      if (index === null) return;
      const next = (index + d + items.length) % items.length;
      setDir(d);
      onIndex(next);
    },
    [index, items.length, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  // Precarga de las fotos vecinas para que el paso sea instantáneo
  useEffect(() => {
    if (index === null) return;
    for (const d of [1, -1]) {
      const src = items[(index + d + items.length) % items.length]?.src;
      if (src) new Image().src = src;
    }
  }, [index, items]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-[70] bg-[#060d0a]" />
        <Dialog.Content className="anim-overlay fixed inset-0 z-[70] flex flex-col text-white outline-none" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Foto de obra</Dialog.Title>
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <p className="tabular text-[13px] text-white/60">
              {index !== null ? index + 1 : 0} / {items.length}
            </p>
            <div className="ml-auto flex items-center gap-2">
              {side && (
                <button onClick={() => setCompare((v) => !v)} className={cn("inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition", compare ? "bg-white text-[#0e1a15]" : "bg-white/10 text-white hover:bg-white/20")}>
                  <Box size={15} /> {compare ? "Ocultar modelo 3D" : sideLabel}
                </button>
              )}
              <Dialog.Close className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" aria-label="Cerrar">
                <X size={19} />
              </Dialog.Close>
            </div>
          </div>

          <div className={cn("relative grid min-h-0 flex-1 gap-3 px-2 sm:px-6", compare && side ? "grid-rows-2 md:grid-cols-2 md:grid-rows-1" : "grid-cols-1")}>
            <div className="relative min-h-0 overflow-hidden rounded-[18px]">
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                {item && (
                  <motion.div
                    key={item.id}
                    custom={dir}
                    className="absolute inset-0 grid place-items-center"
                    initial={{ opacity: 0, x: dir * 60, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: dir * -60, scale: 0.98 }}
                    transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.18}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -70) go(1);
                      else if (info.offset.x > 70) go(-1);
                    }}
                  >
                    {/* Miniatura borrosa de fondo mientras llega la foto completa */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.thumb && <img src={item.thumb} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.src ?? item.thumb} alt={item.caption || "Foto de obra"} draggable={false} className="relative max-h-full max-w-full rounded-[12px] object-contain shadow-2xl" />
                  </motion.div>
                )}
              </AnimatePresence>
              {items.length > 1 && (
                <>
                  <NavBtn side="left" onClick={() => go(-1)} />
                  <NavBtn side="right" onClick={() => go(1)} />
                </>
              )}
            </div>
            {compare && side && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className="relative min-h-0 overflow-hidden rounded-[18px] bg-[#0e1a15] ring-1 ring-white/10">
                {side}
              </motion.div>
            )}
          </div>

          <div className="px-4 pt-3 pb-4 sm:px-6">
            {item &&
              (details ? (
                details(item)
              ) : (
                <div className="mx-auto max-w-3xl text-center">
                  {item.caption && <p className="text-[15px] font-medium">{item.caption}</p>}
                  <p className="mt-0.5 text-[12px] text-white/60">
                    {formatDate(item.takenAt)}
                    {item.stage && ` · ${item.stage}`}
                  </p>
                </div>
              ))}
            {items.length > 1 && (
              <div className="scroll-thin mx-auto mt-3 flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:justify-center">
                {items.map((it, i) => (
                  <button key={it.id} onClick={() => (setDir(i > (index ?? 0) ? 1 : -1), onIndex(i))} className={cn("h-12 w-16 shrink-0 overflow-hidden rounded-[8px] transition", i === index ? "opacity-100 ring-2 ring-white" : "opacity-45 hover:opacity-80")} aria-label={`Foto ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.thumb && <img src={it.thumb} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NavBtn({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/55 sm:grid", side === "left" ? "left-3" : "right-3")} aria-label={side === "left" ? "Foto anterior" : "Foto siguiente"}>
      {side === "left" ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
    </button>
  );
}
