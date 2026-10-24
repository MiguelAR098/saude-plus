import type { NextConfig } from "next";

// Exportação estática: o mesmo build serve na Vercel, no GitHub Pages ou em qualquer CDN.
// NEXT_PUBLIC_BASE_PATH só é necessário quando o site fica em subpasta (ex.: /saude-plus no GitHub Pages).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
