import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // for use in a subdirectory domain.com/OpenGenogram uncomment the following lines
  // basePath: "/OpenGenogram",
  // assetPrefix: "/OpenGenogram/",
  allowedDevOrigins: ["127.0.0.1"],
  productionBrowserSourceMaps: false,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
