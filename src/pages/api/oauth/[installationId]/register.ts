import { randomBytes } from "node:crypto";

import type { NextApiRequest, NextApiResponse } from "next";

import { resolveInstallation } from "@/oauth/installations";
import { getOAuthStore, type OAuthClient } from "@/oauth/store";
import { noStore, OAuthRequestError, validateRedirectUri } from "@/oauth/validation";

function stringArray(value: unknown, name: string, required = false) {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value) || !value.length || !value.every((item) => typeof item === "string")) {
    throw new OAuthRequestError(
      "invalid_client_metadata",
      `${name} must be a non-empty string array.`,
    );
  }
  return [...new Set(value)];
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  noStore(response);
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "method_not_allowed" });
  }
  const installationId = Array.isArray(request.query.installationId)
    ? request.query.installationId[0]
    : request.query.installationId;
  const store = getOAuthStore();
  if (!installationId || !(await resolveInstallation(installationId, store))) {
    return response.status(404).json({ error: "invalid_request" });
  }
  try {
    const body = request.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new OAuthRequestError("invalid_client_metadata", "JSON client metadata is required.");
    }
    const redirectUris = stringArray(body.redirect_uris, "redirect_uris", true)!.map(
      validateRedirectUri,
    );
    const grantTypes = stringArray(body.grant_types, "grant_types") ?? ["authorization_code"];
    const responseTypes = stringArray(body.response_types, "response_types") ?? ["code"];
    if (
      grantTypes.some((type) => type !== "authorization_code" && type !== "refresh_token") ||
      !grantTypes.includes("authorization_code") ||
      responseTypes.length !== 1 ||
      responseTypes[0] !== "code" ||
      (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== "none")
    ) {
      throw new OAuthRequestError(
        "invalid_client_metadata",
        "Only public authorization-code clients (with optional refresh tokens) are supported.",
      );
    }
    const clientName =
      typeof body.client_name === "string" && body.client_name.trim()
        ? body.client_name.trim().slice(0, 120)
        : "MCP client";
    const client: OAuthClient = {
      clientId: `mcp_client_${randomBytes(24).toString("base64url")}`,
      installationId,
      clientName,
      redirectUris,
      grantTypes,
      responseTypes,
      tokenEndpointAuthMethod: "none",
      createdAt: Date.now(),
    };
    await store.putClient(client);
    return response.status(201).json({
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      response_types: client.responseTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    });
  } catch (error) {
    if (error instanceof OAuthRequestError) {
      return response.status(error.status).json({
        error: error.oauthError,
        error_description: error.message,
      });
    }
    throw error;
  }
}
