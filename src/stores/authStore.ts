"use client";

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { isRemote, supabase } from "@/lib/supabase";
import { BASE_PATH } from "@/lib/asset";

export type Permission =
  | "project.view"
  | "projects.manage"
  | "tasks.edit"
  | "stages.manage"
  | "quotes.manage"
  | "finance.manage"
  | "inventory.manage"
  | "users.manage";

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
}

interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  permissions: Permission[];
  /** El usuario llegó desde el enlace de "restablecer contraseña" */
  recovery: boolean;
  init: () => () => void;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (input: { firstName: string; lastName: string; email: string; password: string }) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

/** URL a la que vuelven los enlaces de confirmación y recuperación (sirve también bajo GitHub Pages). */
const redirectUrl = () => (typeof window === "undefined" ? undefined : `${window.location.origin}${BASE_PATH}/`);

const translate = (message: string) => {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Confirma tu correo antes de iniciar sesión (revisa tu bandeja de entrada).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (m.includes("password should be at least")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "El correo no es válido.";
  return message;
};

async function fetchProfile(userId: string): Promise<{ profile: Profile | null; permissions: Permission[] }> {
  if (!supabase) return { profile: null, permissions: [] };
  const { data, error } = await supabase.from("profiles").select("id, email, first_name, last_name, role_id, roles(name)").eq("id", userId).maybeSingle();
  if (error || !data) return { profile: null, permissions: [] };
  const { data: perms } = await supabase.from("role_permissions").select("permission_id").eq("role_id", data.role_id);
  const role = data.roles as unknown as { name: string } | null;
  return {
    profile: { id: data.id, email: data.email, firstName: data.first_name, lastName: data.last_name, roleId: data.role_id, roleName: role?.name ?? data.role_id },
    permissions: (perms ?? []).map((p) => p.permission_id as Permission),
  };
}

export const useAuth = create<AuthState>()((set, get) => ({
  ready: !isRemote,
  session: null,
  profile: null,
  permissions: [],
  recovery: false,

  init: () => {
    if (!supabase) return () => {};
    const apply = async (session: Session | null) => {
      const { profile, permissions } = session ? await fetchProfile(session.user.id) : { profile: null, permissions: [] };
      set({ session, profile, permissions, ready: true });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") set({ recovery: true });
      // Evita llamadas a Supabase dentro del callback síncrono (recomendación del SDK)
      setTimeout(() => apply(session), 0);
    });
    return () => data.subscription.unsubscribe();
  },

  refreshProfile: async () => {
    const s = get().session;
    if (!s) return;
    set(await fetchProfile(s.user.id));
  },

  signIn: async (email, password) => {
    if (!supabase) return "Supabase no está configurado.";
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    return error ? translate(error.message) : null;
  },

  signUp: async ({ firstName, lastName, email, password }) => {
    if (!supabase) return { error: "Supabase no está configurado.", needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: redirectUrl(),
        data: { first_name: firstName.trim(), last_name: lastName.trim(), terms_accepted: true },
      },
    });
    if (error) return { error: translate(error.message), needsConfirmation: false };
    // Con confirmación de correo activa, Supabase no devuelve sesión hasta confirmar
    return { error: null, needsConfirmation: !data.session };
  },

  sendPasswordReset: async (email) => {
    if (!supabase) return "Supabase no está configurado.";
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirectUrl() });
    return error ? translate(error.message) : null;
  },

  updatePassword: async (password) => {
    if (!supabase) return "Supabase no está configurado.";
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return translate(error.message);
    set({ recovery: false });
    return null;
  },

  signOut: async () => {
    await supabase?.auth.signOut();
    set({ session: null, profile: null, permissions: [], recovery: false });
  },
}));

/** En modo local todo está permitido; con Supabase depende del rol del usuario. */
export const can = (perm: Permission) => !isRemote || useAuth.getState().permissions.includes(perm);
export const useCan = (perm: Permission) => useAuth((s) => !isRemote || s.permissions.includes(perm));
