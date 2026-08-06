import type { NextConfig } from "next";

const isTauri = process.env.TAURI_BUILD === "1";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Static export for Tauri desktop builds
  ...(isTauri && {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default nextConfig;
