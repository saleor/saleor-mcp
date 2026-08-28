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
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
