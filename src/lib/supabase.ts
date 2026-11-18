import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Cliente de Supabase del navegador (clave pública). Si faltan las variables,
 * la app funciona en modo local con los datos de demostración.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "rc-eos-auth" },
      })
    : null;

export const isRemote = supabase !== null;
