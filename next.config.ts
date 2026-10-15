import type { NextConfig } from "next";

export const basePath = '';
// for use in a subdirectory domain.com/OpenGenogram change it to the following line
// export const basePath = '/OpenGenogram';

const nextConfig: NextConfig = {
  output: 'export',
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
