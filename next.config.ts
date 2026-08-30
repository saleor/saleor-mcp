import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/mcp/[installationId]": ["./schema.graphql"],
  },
  async rewrites() {
    return [
      { source: "/mcp/:installationId", destination: "/api/mcp/:installationId" },
      {
        source: "/.well-known/oauth-protected-resource/mcp/:installationId",
        destination: "/api/oauth/:installationId/protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server/oauth/:installationId",
        destination: "/api/oauth/:installationId/authorization-server",
      },
      {
        source: "/oauth/:installationId/:endpoint(authorize|token|register|revoke)",
        destination: "/api/oauth/:installationId/:endpoint",
      },
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
