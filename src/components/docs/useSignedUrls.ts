"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { signedUrls } from "@/lib/docsApi";

/** URLs firmadas (1 h) para rutas de un bucket privado. Devuelve un mapa ruta → URL. */
export function useSignedUrls(client: SupabaseClient | null, bucket: string, paths: (string | null | undefined)[]) {
  // La clave (rutas ordenadas) evita repetir la petición aunque el arreglo cambie de identidad
  const key = [...new Set(paths.filter((p): p is string => !!p))].sort().join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!client || !key) return;
    let alive = true;
    signedUrls(client, bucket, key.split("|"))
      .then((m) => alive && setUrls((prev) => ({ ...prev, ...m })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [client, bucket, key]);
  return urls;
}
