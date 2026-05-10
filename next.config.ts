import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.microsoft.com" },
      { protocol: "https", hostname: "**.microsoftonline.com" },
    ],
  },
};

export default nextConfig;
