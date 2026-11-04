import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Cesium's static assets (workers, textures, star map) are copied to
  // public/cesium by scripts/copy-cesium-assets.ts; the client sets
  // window.CESIUM_BASE_URL to point at them before Cesium loads.
  poweredByHeader: false,
};

export default nextConfig;
