/**
 * Planos, fotos de obra y enlaces de invitado (Supabase: tablas + buckets privados).
 * Los archivos viven en `{projectId}/...` dentro de project-blueprints y project-photos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Blueprint, ProjectShare, SitePhoto } from "@/types";
import { supabase } from "./supabase";
import { toBlueprint } from "./api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const BLUEPRINT_BUCKET = "project-blueprints";
export const PHOTO_BUCKET = "project-photos";
export const MODEL_BUCKET = "project-models";

function db() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}
function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
function affected(res: { data: unknown[] | null; error: { message: string } | null }) {
  const rows = check(res);
  if (!rows || rows.length === 0) throw new Error("Tu rol no permite este cambio.");
}

// ── Enlaces firmados (con caché) ────────────────────────────────────────
const urlCache = new Map<string, { url: string; exp: number }>();
const TTL = 60 * 60; // 1 h

/** Devuelve URLs firmadas para varias rutas de un bucket, reutilizando las vigentes. */
export async function signedUrls(client: SupabaseClient, bucket: string, paths: string[]) {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of paths) {
    const hit = urlCache.get(`${bucket}/${p}`);
    if (hit && hit.exp > now + 60_000) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length) {
    const { data, error } = await client.storage.from(bucket).createSignedUrls(missing, TTL);
    if (error) throw new Error(error.message);
    for (const d of data ?? []) {
      if (!d.signedUrl || !d.path) continue;
      urlCache.set(`${bucket}/${d.path}`, { url: d.signedUrl, exp: now + TTL * 1000 });
      out[d.path] = d.signedUrl;
    }
  }
  return out;
}

// ── Subida con progreso ─────────────────────────────────────────────────
/** Sube un archivo a Storage informando el avance (supabase-js no expone progreso). */
export async function uploadWithProgress(bucket: string, path: string, body: Blob, contentType: string, onProgress?: (f: number) => void) {
  const c = db();
  const { data } = await c.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${bucket}/${encoded}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("Cache-Control", "max-age=31536000");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Error ${xhr.status}`;
      try {
        msg = JSON.parse(xhr.responseText).message ?? msg;
      } catch {}
      if (/row-level security|unauthorized/i.test(msg)) msg = "Tu rol no permite cargar archivos.";
      if (/maximum allowed size|too large/i.test(msg)) msg = "El archivo supera el tamaño máximo permitido.";
      if (/mime type/i.test(msg)) msg = "Formato no permitido. Usa PDF, JPG, PNG o WEBP.";
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Sin conexión. Revisa tu internet e inténtalo de nuevo."));
    xhr.send(body);
  });
}

async function removeFiles(bucket: string, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await db().storage.from(bucket).remove(list);
}

// ── Planos ──────────────────────────────────────────────────────────────
export interface BlueprintInput {
  id: string;
  projectId: string;
  code: string;
  title: string;
  category: Blueprint["category"];
  level: string;
  revision: string;
  notes: string;
  format: Blueprint["format"];
  filePath: string;
  thumbPath: string | null;
  fileName: string;
  fileSize: number;
  mime: string;
  sortOrder: number;
}

export async function insertBlueprint(b: BlueprintInput) {
  const res = await db()
    .from("blueprints")
    .insert({
      id: b.id,
      project_id: b.projectId,
      code: b.code,
      title: b.title,
      category: b.category,
      level: b.level,
      revision: b.revision,
      notes: b.notes,
      format: b.format,
      src: "",
      illustrative: false,
      file_path: b.filePath,
      thumb_path: b.thumbPath,
      file_name: b.fileName,
      file_size: b.fileSize,
      mime: b.mime,
      sort_order: b.sortOrder,
    })
    .select("*")
    .single();
  return toBlueprint(check(res) as Row);
}

export async function updateBlueprint(id: string, patch: Partial<Pick<Blueprint, "code" | "title" | "category" | "level" | "revision" | "notes">>) {
  affected(await db().from("blueprints").update(patch).eq("id", id).select("id"));
}

export async function deleteBlueprint(b: Blueprint) {
  affected(await db().from("blueprints").delete().eq("id", b.id).select("id"));
  await removeFiles(BLUEPRINT_BUCKET, [b.filePath, b.thumbPath]);
}

// ── Fotos de obra ───────────────────────────────────────────────────────
const toPhoto = (r: Row): SitePhoto => ({
  id: r.id,
  projectId: r.project_id,
  stageId: r.stage_id,
  filePath: r.file_path,
  thumbPath: r.thumb_path,
  caption: r.caption,
  takenAt: r.taken_at,
  width: r.width,
  height: r.height,
  createdAt: r.created_at,
});

export async function listPhotos(projectId: string) {
  const rows = check(await db().from("site_photos").select("*").eq("project_id", projectId).order("taken_at", { ascending: false }).order("created_at", { ascending: false }));
  return (rows as Row[]).map(toPhoto);
}

export async function insertPhoto(p: Omit<SitePhoto, "createdAt">) {
  const res = await db()
    .from("site_photos")
    .insert({ id: p.id, project_id: p.projectId, stage_id: p.stageId, file_path: p.filePath, thumb_path: p.thumbPath, caption: p.caption, taken_at: p.takenAt, width: p.width, height: p.height })
    .select("*")
    .single();
  return toPhoto(check(res) as Row);
}

export async function updatePhoto(id: string, patch: { caption?: string; takenAt?: string; stageId?: string | null }) {
  const row: Row = {};
  if (patch.caption !== undefined) row.caption = patch.caption;
  if (patch.takenAt !== undefined) row.taken_at = patch.takenAt;
  if (patch.stageId !== undefined) row.stage_id = patch.stageId;
  affected(await db().from("site_photos").update(row).eq("id", id).select("id"));
}

export async function deletePhoto(p: SitePhoto) {
  affected(await db().from("site_photos").delete().eq("id", p.id).select("id"));
  await removeFiles(PHOTO_BUCKET, [p.filePath, p.thumbPath]);
}

// ── Enlaces de invitado ─────────────────────────────────────────────────
const toShare = (r: Row): ProjectShare => ({
  id: r.id,
  projectId: r.project_id,
  token: r.token,
  label: r.label,
  showProgress: r.show_progress,
  showModel: r.show_model,
  showPhotos: r.show_photos,
  showBlueprints: r.show_blueprints,
  expiresAt: r.expires_at,
  revokedAt: r.revoked_at,
  viewCount: r.view_count,
  lastViewedAt: r.last_viewed_at,
  createdAt: r.created_at,
});

export async function listShares(projectId: string) {
  const rows = check(await db().from("project_shares").select("*").eq("project_id", projectId).order("created_at", { ascending: false }));
  return (rows as Row[]).map(toShare);
}

export type ShareInput = Pick<ProjectShare, "label" | "showProgress" | "showModel" | "showPhotos" | "showBlueprints" | "expiresAt">;
const shareRow = (s: Partial<ShareInput>) => {
  const r: Row = {};
  if (s.label !== undefined) r.label = s.label;
  if (s.showProgress !== undefined) r.show_progress = s.showProgress;
  if (s.showModel !== undefined) r.show_model = s.showModel;
  if (s.showPhotos !== undefined) r.show_photos = s.showPhotos;
  if (s.showBlueprints !== undefined) r.show_blueprints = s.showBlueprints;
  if (s.expiresAt !== undefined) r.expires_at = s.expiresAt;
  return r;
};

export async function createShare(projectId: string, s: ShareInput) {
  const res = await db()
    .from("project_shares")
    .insert({ project_id: projectId, ...shareRow(s) })
    .select("*")
    .single();
  return toShare(check(res) as Row);
}

export async function updateShare(id: string, s: Partial<ShareInput>) {
  affected(await db().from("project_shares").update(shareRow(s)).eq("id", id).select("id"));
}

export async function revokeShare(id: string) {
  affected(await db().from("project_shares").update({ revoked_at: new Date().toISOString() }).eq("id", id).select("id"));
}

export async function deleteShare(id: string) {
  affected(await db().from("project_shares").delete().eq("id", id).select("id"));
}
