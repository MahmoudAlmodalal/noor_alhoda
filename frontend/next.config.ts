import type { NextConfig } from "next";

function normalizeBackendUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const backendUrl = normalizeBackendUrl(
  process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000"
);

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*/`,
      },
    ];
  },
  output: "standalone",
  devIndicators: false,
};

export default nextConfig;
