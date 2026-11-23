"use client";

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { todayISO, uid } from "@/lib/format";
import { guard, useProjectStore } from "./projectStore";
import { useUI } from "./uiStore";

export interface ProgressEntry {
  id: string;
  date: string;
  pct: number;
  note: string;
}

/** Registro de avance físico real del proyecto activo (alimenta el valor ganado). */
interface ProgressState {
  projectId: string | null;
  entries: ProgressEntry[];
  state: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  add: (input: { date: string; pct: number; note: string }) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

const toast = (title: string, description?: string) => useUI.getState().toast({ title, description, tone: "warning" });
const sort = (l: ProgressEntry[]) => [...l].sort((a, b) => a.date.localeCompare(b.date));

export const useProgress = create<ProgressState>()((set, get) => ({
  projectId: null,
  entries: [],
  state: "idle",

  load: async () => {
    const pid = useProjectStore.getState().projectId;
    if (!pid || !supabase) return;
    if (get().projectId !== pid) set({ projectId: pid, entries: [], state: "loading" });
    const { data, error } = await supabase.from("progress_log").select("*").eq("project_id", pid).order("date");
    if (error) return void (get().state !== "ready" && set({ state: "error" }));
    if (useProjectStore.getState().projectId !== pid) return;
    set({ state: "ready", entries: sort((data ?? []).map((r) => ({ id: r.id, date: r.date, pct: Number(r.pct), note: r.note }))) });
  },

  add: async ({ date, pct, note }) => {
    if (!guard("finance.manage") || !supabase) return false;
    const pid = useProjectStore.getState().projectId;
    const entry: ProgressEntry = { id: uid("prg"), date: date || todayISO(), pct: Math.min(1, Math.max(0, pct)), note: note.trim() };
    const { error } = await supabase.from("progress_log").insert({ id: entry.id, project_id: pid, date: entry.date, pct: entry.pct, note: entry.note });
    if (error) return toast("No se pudo registrar el avance", error.message), false;
    set((s) => ({ entries: sort([...s.entries, entry]) }));
    return true;
  },

  remove: async (id) => {
    if (!guard("finance.manage") || !supabase) return false;
    const { data, error } = await supabase.from("progress_log").delete().eq("id", id).select("id");
    if (error || !data?.length) return toast("No se pudo eliminar el registro", error?.message ?? "Tu rol no permite este cambio."), false;
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    return true;
  },
}));
