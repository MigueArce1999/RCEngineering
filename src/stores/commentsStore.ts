"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { can } from "./authStore";
import { useProjectStore } from "./projectStore";
import { useUI } from "./uiStore";

export type CommentStatus = "new" | "in_progress" | "done" | "dismissed";
export type CommentRef = "general" | "modelo" | "foto" | "plano" | "avance";

export interface ClientComment {
  id: string;
  projectId: string;
  shareId: string | null;
  author: string;
  body: string;
  refType: CommentRef;
  refId: string | null;
  refLabel: string;
  status: CommentStatus;
  reply: string;
  createdAt: string;
  seenAt: string | null;
  resolvedAt: string | null;
  /** Punto del modelo 3D donde el cliente dejó el comentario, con la cámara de ese momento */
  pin: { p: [number, number, number]; cam: [number, number, number]; tgt: [number, number, number]; fov: number } | null;
}

/** Comentarios de clientes del proyecto activo, con aviso al instante (Realtime) y respaldo por consulta periódica. */
interface CommentsState {
  projectId: string | null;
  items: ClientComment[];
  state: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  start: () => void;
  stop: () => void;
  setStatus: (id: string, status: CommentStatus) => Promise<boolean>;
  sendReply: (id: string, reply: string) => Promise<boolean>;
  markSeen: (ids: string[]) => Promise<void>;
  remove: (id: string) => Promise<boolean>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toComment = (r: any): ClientComment => ({
  id: r.id,
  projectId: r.project_id,
  shareId: r.share_id,
  author: r.author,
  body: r.body,
  refType: r.ref_type,
  refId: r.ref_id,
  refLabel: r.ref_label ?? "",
  status: r.status,
  reply: r.reply ?? "",
  createdAt: r.created_at,
  seenAt: r.seen_at,
  resolvedAt: r.resolved_at,
  pin: r.pin ?? null,
});

const fail = (title: string, description?: string) => useUI.getState().toast({ title, description, tone: "warning" });
let channel: RealtimeChannel | null = null;
let poll: number | null = null;

export const useComments = create<CommentsState>()((set, get) => ({
  projectId: null,
  items: [],
  state: "idle",

  load: async () => {
    const pid = useProjectStore.getState().projectId;
    if (!pid || !supabase || !can("projects.manage")) return;
    if (get().projectId !== pid) set({ projectId: pid, items: [], state: "loading" });
    const { data, error } = await supabase.from("client_comments").select("*").eq("project_id", pid).order("created_at", { ascending: false });
    if (error) return void (get().state !== "ready" && set({ state: "error" }));
    if (useProjectStore.getState().projectId !== pid) return;
    set({ items: (data ?? []).map(toComment), state: "ready" });
  },

  start: () => {
    if (!supabase || channel || !can("projects.manage")) return;
    void get().load();
    channel = supabase
      .channel("client-comments")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_comments" }, (payload) => {
        const pid = useProjectStore.getState().projectId;
        if (payload.eventType === "DELETE") return set((s) => ({ items: s.items.filter((c) => c.id !== (payload.old as any).id) }));
        const c = toComment(payload.new);
        if (c.projectId !== pid) return;
        const exists = get().items.some((x) => x.id === c.id);
        set((s) => ({ items: exists ? s.items.map((x) => (x.id === c.id ? c : x)) : [c, ...s.items] }));
        if (!exists && payload.eventType === "INSERT") {
          useUI.getState().toast({ title: `Nuevo comentario de ${c.author}`, description: c.body.length > 90 ? `${c.body.slice(0, 90)}…` : c.body, tone: "info" });
        }
      })
      .subscribe();
    // Respaldo por si se pierde la conexión en tiempo real
    poll = window.setInterval(() => void get().load(), 90_000);
  },

  stop: () => {
    if (channel) void supabase?.removeChannel(channel);
    channel = null;
    if (poll) window.clearInterval(poll);
    poll = null;
  },

  setStatus: async (id, status) => {
    if (!supabase) return false;
    const prev = get().items;
    const now = new Date().toISOString();
    const patch = { status, resolved_at: status === "done" || status === "dismissed" ? now : null, seen_at: prev.find((c) => c.id === id)?.seenAt ?? now };
    set({ items: prev.map((c) => (c.id === id ? { ...c, status, resolvedAt: patch.resolved_at, seenAt: patch.seen_at } : c)) });
    const { data, error } = await supabase.from("client_comments").update(patch).eq("id", id).select("id");
    if (error || !data?.length) {
      set({ items: prev });
      fail("No se pudo actualizar el comentario", error?.message ?? "Tu rol no permite este cambio.");
      return false;
    }
    return true;
  },

  sendReply: async (id, reply) => {
    if (!supabase) return false;
    const prev = get().items;
    set({ items: prev.map((c) => (c.id === id ? { ...c, reply } : c)) });
    const { data, error } = await supabase.from("client_comments").update({ reply }).eq("id", id).select("id");
    if (error || !data?.length) {
      set({ items: prev });
      fail("No se pudo guardar la respuesta", error?.message ?? "Tu rol no permite este cambio.");
      return false;
    }
    return true;
  },

  markSeen: async (ids) => {
    if (!supabase || !ids.length) return;
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((c) => (ids.includes(c.id) ? { ...c, seenAt: c.seenAt ?? now } : c)) }));
    await supabase.from("client_comments").update({ seen_at: now }).in("id", ids).is("seen_at", null);
  },

  remove: async (id) => {
    if (!supabase) return false;
    const prev = get().items;
    set({ items: prev.filter((c) => c.id !== id) });
    const { data, error } = await supabase.from("client_comments").delete().eq("id", id).select("id");
    if (error || !data?.length) {
      set({ items: prev });
      fail("No se pudo eliminar el comentario", error?.message);
      return false;
    }
    return true;
  },
}));

/** Cantidad de comentarios nuevos (sin atender) del proyecto activo. */
export const useNewComments = () => useComments((s) => s.items.filter((c) => c.status === "new").length);
