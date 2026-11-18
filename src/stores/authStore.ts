"use client";

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { isRemote, supabase } from "@/lib/supabase";

interface AuthState {
  ready: boolean;
  session: Session | null;
  email: string | null;
  isEditor: boolean;
  loginOpen: boolean;
  setLoginOpen: (v: boolean) => void;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

async function checkEditor(email: string | null) {
  if (!supabase || !email) return false;
  // La política RLS solo deja ver la fila del propio usuario en public.editors
  const { data, error } = await supabase.from("editors").select("email").limit(1);
  return !error && (data?.length ?? 0) > 0;
}

export const useAuth = create<AuthState>()((set, get) => ({
  ready: !isRemote,
  session: null,
  email: null,
  isEditor: false,
  loginOpen: false,
  setLoginOpen: (loginOpen) => set({ loginOpen }),

  init: () => {
    if (!supabase) return () => {};
    const apply = async (session: Session | null) => {
      const email = session?.user.email ?? null;
      set({ session, email, isEditor: await checkEditor(email), ready: true });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      // Evita llamadas a Supabase dentro del callback síncrono (recomendación del SDK)
      setTimeout(() => apply(session), 0);
    });
    return () => data.subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    if (!supabase) return "Supabase no está configurado.";
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message;
    get().setLoginOpen(false);
    return null;
  },

  signOut: async () => {
    await supabase?.auth.signOut();
    set({ session: null, email: null, isEditor: false });
  },
}));

/** En modo local siempre se puede editar; con Supabase solo los editores autorizados. */
export const canEdit = () => !isRemote || useAuth.getState().isEditor;
