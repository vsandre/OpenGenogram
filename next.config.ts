import type { NextConfig } from "next";


export let basePath = '';
// for use in a subdirectory domain.com/OpenGenogram uncomment the following line
// basePath = '/OpenGenogram';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  basePath: basePath,
  assetPrefix: `${basePath}/`,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
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
