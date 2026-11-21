"use client";

import { create } from "zustand";
import type { Blueprint, ProjectShare, SitePhoto } from "@/types";
import * as api from "@/lib/docsApi";
import { blueprintFormat, blueprintThumbnail, FORMAT_MIME, guessBlueprintMeta, MAX_BLUEPRINT_MB, photoDate, preparePhoto } from "@/lib/docs";
import { uid } from "@/lib/format";
import { can } from "./authStore";
import { guard, useProjectStore } from "./projectStore";
import { useUI } from "./uiStore";

/** Archivo en proceso de carga (planos o fotos). */
export interface UploadJob {
  id: string;
  kind: "blueprint" | "photo";
  name: string;
  size: number;
  progress: number;
  stage: "preparing" | "uploading" | "saving" | "done" | "error";
  error?: string;
  /** Vista previa local mientras sube */
  preview?: string;
  resultId?: string;
}

interface DocsState {
  projectId: string | null;
  photos: SitePhoto[];
  photosState: "idle" | "loading" | "ready" | "error";
  shares: ProjectShare[];
  sharesState: "idle" | "loading" | "ready" | "error";
  jobs: UploadJob[];
  loadPhotos: () => Promise<void>;
  loadShares: () => Promise<void>;
  uploadBlueprints: (files: File[]) => Promise<void>;
  saveBlueprint: (id: string, patch: Partial<Pick<Blueprint, "code" | "title" | "category" | "level" | "revision" | "notes">>) => Promise<boolean>;
  removeBlueprint: (id: string) => Promise<boolean>;
  uploadPhotos: (files: File[], stageId: string | null) => Promise<void>;
  savePhoto: (id: string, patch: { caption?: string; takenAt?: string; stageId?: string | null }) => Promise<boolean>;
  removePhoto: (id: string) => Promise<boolean>;
  createShare: (input: api.ShareInput) => Promise<ProjectShare | null>;
  saveShare: (id: string, patch: Partial<api.ShareInput>) => Promise<boolean>;
  revokeShare: (id: string) => Promise<boolean>;
  deleteShare: (id: string) => Promise<boolean>;
  clearFinishedJobs: () => void;
}

const toast = (title: string, description?: string, tone: "success" | "info" | "warning" = "success") => useUI.getState().toast({ title, description, tone });
const currentProject = () => useProjectStore.getState().projectId;

/** Ejecuta en paralelo con un máximo de tareas a la vez. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

export const useDocs = create<DocsState>()((set, get) => {
  const patchJob = (id: string, p: Partial<UploadJob>) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) }));
  const fail = (id: string, e: unknown) => patchJob(id, { stage: "error", error: (e as Error).message });
  const resetIfProjectChanged = () => {
    const pid = currentProject();
    if (pid && get().projectId !== pid) set({ projectId: pid, photos: [], photosState: "idle", shares: [], sharesState: "idle" });
    return pid;
  };

  return {
    projectId: null,
    photos: [],
    photosState: "idle",
    shares: [],
    sharesState: "idle",
    jobs: [],

    loadPhotos: async () => {
      const pid = resetIfProjectChanged();
      if (!pid) return;
      if (get().photosState !== "ready") set({ photosState: "loading" });
      try {
        const photos = await api.listPhotos(pid);
        if (currentProject() === pid) set({ photos, photosState: "ready" });
      } catch {
        if (get().photosState !== "ready") set({ photosState: "error" });
      }
    },

    loadShares: async () => {
      const pid = resetIfProjectChanged();
      if (!pid || !can("projects.manage")) return;
      if (get().sharesState !== "ready") set({ sharesState: "loading" });
      try {
        const shares = await api.listShares(pid);
        if (currentProject() === pid) set({ shares, sharesState: "ready" });
      } catch {
        if (get().sharesState !== "ready") set({ sharesState: "error" });
      }
    },

    // ── Planos ──
    uploadBlueprints: async (files) => {
      if (!guard("documents.manage")) return;
      const pid = currentProject();
      if (!pid) return;
      const accepted: { file: File; job: UploadJob; format: Blueprint["format"] }[] = [];
      for (const file of files) {
        const format = blueprintFormat(file);
        if (!format) {
          toast(`“${file.name}” no es un plano compatible`, "Usa PDF, JPG, PNG o WEBP.", "warning");
          continue;
        }
        if (file.size > MAX_BLUEPRINT_MB * 1024 * 1024) {
          toast(`“${file.name}” supera ${MAX_BLUEPRINT_MB} MB`, "Exporta el plano con menor resolución o divídelo por hojas.", "warning");
          continue;
        }
        const job: UploadJob = { id: uid("up"), kind: "blueprint", name: file.name, size: file.size, progress: 0, stage: "preparing" };
        accepted.push({ file, job, format });
      }
      if (!accepted.length) return;
      set((s) => ({ jobs: [...s.jobs, ...accepted.map((a) => a.job)] }));

      let ok = 0;
      await pool(accepted, 3, async ({ file, job, format }) => {
        try {
          const thumb = await blueprintThumbnail(file, format);
          if (thumb) patchJob(job.id, { preview: URL.createObjectURL(thumb) });
          const id = uid("bp");
          const ext = format === "jpg" ? "jpg" : format;
          const filePath = `${pid}/${id}.${ext}`;
          const thumbPath = thumb ? `${pid}/thumbs/${id}.jpg` : null;
          patchJob(job.id, { stage: "uploading" });
          await api.uploadWithProgress(api.BLUEPRINT_BUCKET, filePath, file, FORMAT_MIME[format], (f) => patchJob(job.id, { progress: f * (thumb ? 0.92 : 1) }));
          if (thumb && thumbPath) await api.uploadWithProgress(api.BLUEPRINT_BUCKET, thumbPath, thumb, "image/jpeg");
          patchJob(job.id, { stage: "saving", progress: 1 });
          const existing = useProjectStore.getState().blueprints;
          const meta = guessBlueprintMeta(file.name, existing.map((b) => b.code));
          const saved = await api.insertBlueprint({
            id,
            projectId: pid,
            ...meta,
            notes: "",
            format,
            filePath,
            thumbPath,
            fileName: file.name,
            fileSize: file.size,
            mime: FORMAT_MIME[format],
            sortOrder: existing.length,
          });
          useProjectStore.setState((s) => ({ blueprints: [...s.blueprints.filter((b) => !b.illustrative), saved] }));
          patchJob(job.id, { stage: "done", resultId: id });
          ok++;
        } catch (e) {
          fail(job.id, e);
        }
      });
      if (ok) toast(ok === 1 ? "Plano cargado" : `${ok} planos cargados`, "Revisa el código, el título y la categoría propuestos.");
    },

    saveBlueprint: async (id, patch) => {
      if (!guard("documents.manage")) return false;
      const prev = useProjectStore.getState().blueprints;
      useProjectStore.setState({ blueprints: prev.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
      try {
        await api.updateBlueprint(id, patch);
        return true;
      } catch (e) {
        useProjectStore.setState({ blueprints: prev });
        toast("No se pudo guardar el plano", (e as Error).message, "warning");
        return false;
      }
    },

    removeBlueprint: async (id) => {
      if (!guard("documents.manage")) return false;
      const prev = useProjectStore.getState().blueprints;
      const b = prev.find((x) => x.id === id);
      if (!b) return false;
      useProjectStore.setState({ blueprints: prev.filter((x) => x.id !== id) });
      try {
        await api.deleteBlueprint(b);
        return true;
      } catch (e) {
        useProjectStore.setState({ blueprints: prev });
        toast("No se pudo eliminar el plano", (e as Error).message, "warning");
        return false;
      }
    },

    // ── Fotos ──
    uploadPhotos: async (files, stageId) => {
      if (!guard("documents.manage")) return;
      const pid = currentProject();
      if (!pid) return;
      const images = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
      if (images.length < files.length) toast("Algunos archivos no son fotos compatibles", "Usa JPG, PNG o WEBP (en iPhone: Ajustes › Cámara › Formatos › Más compatible).", "warning");
      const jobs = images.map((file) => ({ file, job: { id: uid("up"), kind: "photo" as const, name: file.name, size: file.size, progress: 0, stage: "preparing" as const, preview: URL.createObjectURL(file) } }));
      if (!jobs.length) return;
      set((s) => ({ jobs: [...s.jobs, ...jobs.map((j) => j.job)] }));

      let ok = 0;
      await pool(jobs, 3, async ({ file, job }) => {
        try {
          const { full, thumb } = await preparePhoto(file);
          const id = uid("ph");
          const filePath = `${pid}/${id}.jpg`;
          const thumbPath = `${pid}/thumbs/${id}.jpg`;
          patchJob(job.id, { stage: "uploading" });
          await api.uploadWithProgress(api.PHOTO_BUCKET, filePath, full.blob, "image/jpeg", (f) => patchJob(job.id, { progress: f * 0.9 }));
          await api.uploadWithProgress(api.PHOTO_BUCKET, thumbPath, thumb.blob, "image/jpeg");
          patchJob(job.id, { stage: "saving", progress: 1 });
          const saved = await api.insertPhoto({ id, projectId: pid, stageId, filePath, thumbPath, caption: "", takenAt: photoDate(file), width: full.width, height: full.height });
          set((s) => ({ photos: [saved, ...s.photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt) || b.createdAt.localeCompare(a.createdAt)) }));
          patchJob(job.id, { stage: "done", resultId: id });
          ok++;
        } catch (e) {
          fail(job.id, e);
        }
      });
      if (ok) toast(ok === 1 ? "Foto agregada al registro de obra" : `${ok} fotos agregadas al registro de obra`);
    },

    savePhoto: async (id, patch) => {
      if (!guard("documents.manage")) return false;
      const prev = get().photos;
      set({ photos: prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
      try {
        await api.updatePhoto(id, patch);
        return true;
      } catch (e) {
        set({ photos: prev });
        toast("No se pudo guardar la foto", (e as Error).message, "warning");
        return false;
      }
    },

    removePhoto: async (id) => {
      if (!guard("documents.manage")) return false;
      const prev = get().photos;
      const p = prev.find((x) => x.id === id);
      if (!p) return false;
      set({ photos: prev.filter((x) => x.id !== id) });
      try {
        await api.deletePhoto(p);
        return true;
      } catch (e) {
        set({ photos: prev });
        toast("No se pudo eliminar la foto", (e as Error).message, "warning");
        return false;
      }
    },

    // ── Invitados ──
    createShare: async (input) => {
      if (!guard("projects.manage")) return null;
      const pid = currentProject();
      if (!pid) return null;
      try {
        const s = await api.createShare(pid, input);
        set((st) => ({ shares: [s, ...st.shares] }));
        return s;
      } catch (e) {
        toast("No se pudo crear el enlace", (e as Error).message, "warning");
        return null;
      }
    },

    saveShare: async (id, patch) => {
      if (!guard("projects.manage")) return false;
      const prev = get().shares;
      set({ shares: prev.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
      try {
        await api.updateShare(id, patch);
        return true;
      } catch (e) {
        set({ shares: prev });
        toast("No se pudo guardar el enlace", (e as Error).message, "warning");
        return false;
      }
    },

    revokeShare: async (id) => {
      if (!guard("projects.manage")) return false;
      const prev = get().shares;
      set({ shares: prev.map((s) => (s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s)) });
      try {
        await api.revokeShare(id);
        return true;
      } catch (e) {
        set({ shares: prev });
        toast("No se pudo desactivar el enlace", (e as Error).message, "warning");
        return false;
      }
    },

    deleteShare: async (id) => {
      if (!guard("projects.manage")) return false;
      const prev = get().shares;
      set({ shares: prev.filter((s) => s.id !== id) });
      try {
        await api.deleteShare(id);
        return true;
      } catch (e) {
        set({ shares: prev });
        toast("No se pudo eliminar el enlace", (e as Error).message, "warning");
        return false;
      }
    },

    clearFinishedJobs: () =>
      set((s) => {
        for (const j of s.jobs) if (j.stage === "done" && j.preview) URL.revokeObjectURL(j.preview);
        return { jobs: s.jobs.filter((j) => j.stage !== "done") };
      }),
  };
});
