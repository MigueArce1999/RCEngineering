import type { NextConfig } from "next";

// Con NEXT_PUBLIC_BASE_PATH (GitHub Pages) se genera un sitio estático en ./out servido bajo ese subdirectorio.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  poweredByHeader: false,
  images: { unoptimized: true },
  ...(basePath ? { output: "export" as const, basePath, trailingSlash: true } : {}),
};

export default nextConfig;
