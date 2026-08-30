import { createHmac } from "node:crypto";

import type { AuthData } from "@saleor/app-sdk/APL";
import type { NextApiRequest } from "next";

export class OAuthConfigurationError extends Error {}

type Environment = Record<string, string | undefined>;

export function getOAuthSecret(env: Environment = process.env): Uint8Array {
  const raw = env.MCP_OAUTH_SECRET ?? env.MCP_CREDENTIAL_SECRET;
  if (!raw || raw.length < 32) {
    throw new OAuthConfigurationError("MCP_OAUTH_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(raw);
}

export function canonicalUrl(raw: string, options: { allowPath?: boolean } = {}): string {
  const url = new URL(raw);
  if (url.username || url.password || url.hash || url.search)
    throw new Error("URL must not contain credentials, query, or fragment.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    throw new Error("URL must use HTTPS (HTTP is allowed only for loopback development). ");
  }
  if (!options.allowPath && url.pathname !== "/")
    throw new Error("Origin URL must not contain a path.");
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (!options.allowPath) url.pathname = "";
  return url.toString().replace(/\/$/, "");
}

export function isLoopbackHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

export function getPublicBaseUrl(request?: NextApiRequest, env: Environment = process.env) {
  if (env.APP_API_BASE_URL) return canonicalUrl(env.APP_API_BASE_URL);
  if (env.NODE_ENV === "production") {
    throw new OAuthConfigurationError(
      "APP_API_BASE_URL is required in production so OAuth issuer and audience values cannot be influenced by request headers.",
    );
  }
  if (!request) throw new OAuthConfigurationError("APP_API_BASE_URL is required.");
  const hostHeader = request.headers["x-forwarded-host"] ?? request.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = request.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) ??
    (host?.startsWith("localhost") ? "http" : "https");
  if (!host || host.includes(",") || proto.includes(","))
    throw new OAuthConfigurationError("Invalid public host headers.");
  return canonicalUrl(`${proto}://${host}`);
}

export function deriveInstallationId(
  authData: Pick<AuthData, "appId" | "saleorApiUrl">,
  env: Environment = process.env,
) {
  const secret = Buffer.from(getOAuthSecret(env));
  return createHmac("sha256", secret)
    .update("saleor-mcp-installation\0")
    .update(authData.appId)
    .update("\0")
    .update(authData.saleorApiUrl)
    .digest("base64url")
    .slice(0, 32);
}

export function oauthIssuer(baseUrl: string, installationId: string) {
  return `${baseUrl}/oauth/${encodeURIComponent(installationId)}`;
}

export function mcpResource(baseUrl: string, installationId: string) {
  return `${baseUrl}/mcp/${encodeURIComponent(installationId)}`;
}

export function protectedResourceMetadataUrl(baseUrl: string, installationId: string) {
  return `${baseUrl}/.well-known/oauth-protected-resource/mcp/${encodeURIComponent(installationId)}`;
}

export function normalizeDashboardOrigin(value: string) {
  return canonicalUrl(value);
}
