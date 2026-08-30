import { createHash, randomBytes, randomUUID } from "node:crypto";

import { decodeJwt, jwtVerify, SignJWT } from "jose";

import { getOAuthSecret, oauthIssuer } from "./config";
import type { OAuthStore, RefreshTokenGrant } from "./store";

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
// Re-consent is required after one workday so a Dashboard permission change
// cannot be extended indefinitely by refresh-token rotation.
const REFRESH_TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000;

export type McpPrincipal = {
  subject: string;
  installationId: string;
  saleorApiUrl: string;
  appId: string;
  userEmail: string;
  saleorPermissions: string[];
  scopes: string[];
  audience: string;
  clientId: string;
  tokenId: string;
  expiresAt: number;
};

export function randomOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function deriveUserSubject(installationId: string, email: string) {
  return createHash("sha256")
    .update("saleor-mcp-user\0")
    .update(installationId)
    .update("\0")
    .update(email.trim().toLowerCase())
    .digest("base64url");
}

type AccessTokenInput = Omit<McpPrincipal, "tokenId" | "expiresAt"> & { baseUrl: string };

export async function issueAccessToken(input: AccessTokenInput) {
  const tokenId = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS;
  const issuer = oauthIssuer(input.baseUrl, input.installationId);
  const accessToken = await new SignJWT({
    scope: input.scopes.join(" "),
    client_id: input.clientId,
    installation_id: input.installationId,
    saleor_api_url: input.saleorApiUrl,
    app_id: input.appId,
    user_email: input.userEmail,
    saleor_permissions: input.saleorPermissions,
  })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setIssuer(issuer)
    .setSubject(input.subject)
    .setAudience(input.audience)
    .setJti(tokenId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getOAuthSecret());
  return { accessToken, tokenId, expiresAt, expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS };
}

export async function verifyAccessToken(
  token: string,
  expected: { baseUrl: string; installationId: string; resource: string },
): Promise<McpPrincipal> {
  const { payload, protectedHeader } = await jwtVerify(token, getOAuthSecret(), {
    algorithms: ["HS256"],
    issuer: oauthIssuer(expected.baseUrl, expected.installationId),
    audience: expected.resource,
    typ: "at+jwt",
  });
  if (
    protectedHeader.typ !== "at+jwt" ||
    payload.installation_id !== expected.installationId ||
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.saleor_api_url !== "string" ||
    typeof payload.app_id !== "string" ||
    typeof payload.user_email !== "string" ||
    typeof payload.client_id !== "string" ||
    !Array.isArray(payload.saleor_permissions) ||
    !payload.saleor_permissions.every((permission) => typeof permission === "string")
  ) {
    throw new Error("Malformed access token.");
  }
  return {
    subject: payload.sub,
    installationId: expected.installationId,
    saleorApiUrl: payload.saleor_api_url,
    appId: payload.app_id,
    userEmail: payload.user_email,
    saleorPermissions: payload.saleor_permissions as string[],
    scopes: typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [],
    audience: expected.resource,
    clientId: payload.client_id,
    tokenId: payload.jti,
    expiresAt: payload.exp,
  };
}

export async function issueTokenPair(
  input: AccessTokenInput,
  store: OAuthStore,
): Promise<Record<string, unknown>> {
  const access = await issueAccessToken(input);
  const refreshToken = randomOpaqueToken("mcp_rt");
  const refreshGrant: RefreshTokenGrant = {
    tokenHash: hashOpaqueToken(refreshToken),
    installationId: input.installationId,
    clientId: input.clientId,
    resource: input.audience,
    scopes: input.scopes,
    subject: input.subject,
    userEmail: input.userEmail,
    saleorPermissions: input.saleorPermissions,
    expiresAt: Date.now() + REFRESH_TOKEN_LIFETIME_MS,
  };
  await store.putRefreshToken(refreshGrant);
  return {
    access_token: access.accessToken,
    token_type: "Bearer",
    expires_in: access.expiresIn,
    refresh_token: refreshToken,
    scope: input.scopes.join(" "),
  };
}

export function unsafeAccessTokenClaims(token: string) {
  return decodeJwt(token);
}
