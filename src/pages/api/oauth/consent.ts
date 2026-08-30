import { randomBytes } from "node:crypto";

import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";

import { deriveInstallationId } from "@/oauth/config";
import { grantableOAuthScopes } from "@/oauth/scopes";
import { getOAuthStore } from "@/oauth/store";
import { deriveUserSubject, hashOpaqueToken } from "@/oauth/tokens";
import { noStore } from "@/oauth/validation";
import { saleorApp } from "@/saleor-app";

function authorizationRedirect(redirectUri: string, values: Record<string, string | undefined>) {
  const target = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) target.searchParams.set(key, value);
  }
  return target.toString();
}

export const consentHandler: Parameters<typeof createProtectedHandler>[0] = async (
  request,
  response,
  context,
) => {
  noStore(response);
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const requestId =
    request.method === "GET"
      ? Array.isArray(request.query.request)
        ? request.query.request[0]
        : request.query.request
      : typeof request.body?.request === "string"
        ? request.body.request
        : undefined;
  if (!requestId || !/^[A-Za-z0-9_-]{43}$/.test(requestId)) {
    return response.status(400).json({ error: "Invalid authorization request." });
  }
  const store = getOAuthStore();
  const pending = await store.getAuthorizationRequest(requestId);
  if (!pending || pending.installationId !== deriveInstallationId(context.authData)) {
    return response.status(404).json({ error: "Authorization request expired or is invalid." });
  }
  const client = await store.getClient(pending.installationId, pending.clientId);
  if (!client) return response.status(404).json({ error: "OAuth client no longer exists." });
  const permissions = context.user.userPermissions.map(String);
  const grantableScopes = grantableOAuthScopes(pending.scopes, permissions);

  if (request.method === "GET") {
    return response.status(200).json({
      clientName: client.clientName,
      clientId: client.clientId,
      redirectHost: new URL(pending.redirectUri).host,
      requestedScopes: pending.scopes,
      grantableScopes,
      userEmail: context.user.email,
      expiresAt: pending.expiresAt,
    });
  }

  const decision = request.body?.decision;
  if (decision !== "allow" && decision !== "deny") {
    return response.status(400).json({ error: "decision must be allow or deny." });
  }
  const consumed = await store.consumeAuthorizationRequest(requestId);
  if (!consumed) {
    return response.status(409).json({ error: "Authorization request was already handled." });
  }
  if (decision === "deny") {
    return response.status(200).json({
      redirectTo: authorizationRedirect(consumed.redirectUri, {
        error: "access_denied",
        error_description: "The Saleor user denied this authorization request.",
        state: consumed.state,
      }),
    });
  }
  if (consumed.scopes.length > 0 && grantableScopes.length === 0) {
    return response.status(200).json({
      redirectTo: authorizationRedirect(consumed.redirectUri, {
        error: "access_denied",
        error_description: "The Saleor user cannot grant any of the requested MCP scopes.",
        state: consumed.state,
      }),
    });
  }
  const code = `mcp_ac_${randomBytes(32).toString("base64url")}`;
  await store.putAuthorizationCode({
    codeHash: hashOpaqueToken(code),
    installationId: consumed.installationId,
    clientId: consumed.clientId,
    redirectUri: consumed.redirectUri,
    resource: consumed.resource,
    scopes: grantableScopes,
    codeChallenge: consumed.codeChallenge,
    subject: deriveUserSubject(consumed.installationId, context.user.email),
    userEmail: context.user.email,
    saleorPermissions: permissions,
    expiresAt: Date.now() + 2 * 60 * 1000,
  });
  return response.status(200).json({
    redirectTo: authorizationRedirect(consumed.redirectUri, {
      code,
      state: consumed.state,
    }),
  });
};

export default createProtectedHandler(consentHandler, saleorApp.apl);
