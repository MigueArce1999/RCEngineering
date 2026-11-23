/**
 * Caché persistente (IndexedDB) del HTML del modelo 3D. La ruta del archivo incluye una marca de tiempo,
 * así que nunca cambia de contenido: la segunda visita carga al instante sin descargar 1–3 MB otra vez.
 */
const DB = "rc-model-cache";
const STORE = "html";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getCachedModel(path: string): Promise<string | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const r = db.transaction(STORE).objectStore(STORE).get(path);
      r.onsuccess = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Guarda el modelo y descarta los demás (solo interesa el vigente). */
export async function putCachedModel(path: string, html: string) {
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    st.clear();
    st.put(html, path);
  } catch {
    /* sin caché: no pasa nada */
  }
}
