/**
 * Prefijo de ruta para publicar bajo un subdirectorio (p. ej. GitHub Pages: /RCEngineering).
 * Se define en el build con NEXT_PUBLIC_BASE_PATH; en desarrollo queda vacío.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => `${BASE_PATH}${path}`;
