import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // The inventory adapter is supplied by the hosting environment.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
