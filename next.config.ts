import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/mcp": ["./schema.graphql"],
  },
  async rewrites() {
    return [
      { source: "/mcp", destination: "/api/mcp" },
      { source: "/health", destination: "/api/health" },
    ];
  },
};

export default nextConfig;
