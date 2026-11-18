import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Three.js ecosystem ships ESM that Next compiles fine; transpile drei helpers explicitly.
  transpilePackages: ["three"],
  poweredByHeader: false,
};

export default nextConfig;
