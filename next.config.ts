import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produce a self-contained .next/standalone build for Docker.
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
