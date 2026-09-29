import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: 'out',
  trailingSlash: true,
  // for use in a subdirectory domain.com/OpenGenogram uncomment the following lines
  // basePath: "/OpenGenogram",
  // assetPrefix: "/OpenGenogram/",
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  productionBrowserSourceMaps: false,
  turbopack: { root: process.cwd() },
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
  compiler: {
    removeConsole: true,
  },
};

export default nextConfig;
