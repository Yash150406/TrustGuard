import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/headers";

const nextConfig: NextConfig = {
  transpilePackages: ["@trustguard/core", "@trustguard/db"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
