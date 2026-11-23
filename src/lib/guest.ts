/**
 * Acceso de invitados: cliente de Supabase SIN sesión que presenta el token del enlace
 * en la cabecera x-guest-token (las políticas de Storage lo validan) y la vista guest_view.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BlueprintCategory, StageIcon } from "@/types";

export interface GuestStage {
  id: string;
  name: string;
  icon: StageIcon;
  order: number;
  weight: number;
  total: number;
  done: number;
  inProgress: number;
}
export interface GuestPhoto {
  id: string;
  path: string;
  thumb: string;
  caption: string;
  takenAt: string;
  width: number;
  height: number;
  stageId: string | null;
}
export interface GuestBlueprint {
  id: string;
  code: string;
  title: string;
  category: BlueprintCategory;
  level: string;
  revision: string;
  path: string;
  thumb: string | null;
  mime: string;
  fileName: string;
  uploadedAt: string;
}
export interface GuestView {
  share: { label: string; expiresAt: string | null; showProgress: boolean; showModel: boolean; showPhotos: boolean; showBlueprints: boolean };
  project: {
    id: string;
    code: string;
    name: string;
    city: string;
    country: string;
    type: string;
    builtAreaM2: number;
    levels: number;
    structuralSystem: string;
    status: "active" | "paused" | "closed";
    startDate: string;
    plannedEndDate: string;
    description: string;
  };
  stages?: GuestStage[];
  model?: { path: string; settings: Record<string, string> };
  photos?: GuestPhoto[];
  blueprints?: GuestBlueprint[];
}

export function guestClient(token: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "rc-guest" },
    global: { headers: { "x-guest-token": token } },
  });
}

export async function fetchGuestView(client: SupabaseClient, token: string) {
  const { data, error } = await client.rpc("guest_view", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as GuestView | null) ?? null;
}

export async function downloadGuestModel(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from("project-models").download(path);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar el modelo");
  return data.text();
}

/** Avance ponderado (igual que en el dashboard): etapas por peso, actividades terminadas. */
export function guestProgress(stages: GuestStage[]) {
  const wsum = stages.reduce((s, st) => s + Number(st.weight), 0) || 1;
  return stages.reduce((acc, st) => acc + (Number(st.weight) / wsum) * (st.total ? st.done / st.total : 0), 0);
}
export const stageState = (s: GuestStage) => (s.total > 0 && s.done === s.total ? "completed" : s.done > 0 || s.inProgress > 0 ? "in_progress" : "pending");

export type GuestRef = { type: "general" | "modelo" | "foto" | "plano" | "avance"; id?: string | null; label?: string };
export interface GuestComment {
  id: string;
  author: string;
  body: string;
  refType: GuestRef["type"];
  refLabel: string;
  status: "new" | "in_progress" | "done" | "dismissed";
  reply: string;
  createdAt: string;
}

export async function fetchGuestComments(client: SupabaseClient, token: string) {
  const { data, error } = await client.rpc("guest_comments", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as { allow: boolean; items: GuestComment[] } | null) ?? { allow: false, items: [] };
}

export async function sendGuestComment(client: SupabaseClient, token: string, input: { author: string; body: string; ref: GuestRef }) {
  const { error } = await client.rpc("guest_add_comment", { p_token: token, p_author: input.author, p_body: input.body, p_ref_type: input.ref.type, p_ref_id: input.ref.id ?? null, p_ref_label: input.ref.label ?? "" });
  if (error) throw new Error(error.message);
}
