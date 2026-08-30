import { randomBytes } from "node:crypto";

import type { NextApiRequest, NextApiResponse } from "next";

import { getPublicBaseUrl, mcpResource } from "@/oauth/config";
import { resolveInstallation } from "@/oauth/installations";
import { parseRequestedScopes } from "@/oauth/scopes";
import { getOAuthStore } from "@/oauth/store";
import { noStore, OAuthRequestError, single, validatePkceChallenge } from "@/oauth/validation";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  noStore(response);
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "method_not_allowed" });
  }
  const installationId = Array.isArray(request.query.installationId)
    ? request.query.installationId[0]
    : request.query.installationId;
  const store = getOAuthStore();
  const installation = installationId
    ? await resolveInstallation(installationId, store)
    : undefined;
  if (!installationId || !installation) {
    return response.status(404).json({ error: "invalid_request" });
  }
  let safeRedirectUri: string | undefined;
  let requestState: string | undefined;
  try {
    const clientId = single(request.query.client_id, "client_id")!;
    const client = await store.getClient(installationId, clientId);
    if (!client) throw new OAuthRequestError("unauthorized_client", "Unknown OAuth client.");
    const redirectUri = single(request.query.redirect_uri, "redirect_uri")!;
    if (!client.redirectUris.includes(redirectUri)) {
      throw new OAuthRequestError("invalid_request", "redirect_uri is not registered.");
    }
    safeRedirectUri = redirectUri;
    requestState = single(request.query.state, "state", false);
    if (single(request.query.response_type, "response_type") !== "code") {
      throw new OAuthRequestError(
        "unsupported_response_type",
        "Only response_type=code is supported.",
      );
    }
    const expectedResource = mcpResource(getPublicBaseUrl(request), installationId);
    const resource = single(request.query.resource, "resource")!;
    if (resource !== expectedResource) {
      throw new OAuthRequestError(
        "invalid_target",
        "resource must exactly identify this MCP endpoint.",
      );
    }
    const codeChallenge = validatePkceChallenge(
      single(request.query.code_challenge, "code_challenge")!,
      single(request.query.code_challenge_method, "code_challenge_method"),
    );
    if (requestState && requestState.length > 512)
      throw new OAuthRequestError("invalid_request", "state is too long.");
    let scopes: string[];
    try {
      scopes = parseRequestedScopes(single(request.query.scope, "scope", false));
    } catch {
      throw new OAuthRequestError(
        "invalid_scope",
        "One or more requested scopes are not supported.",
      );
    }
    const requestId = randomBytes(32).toString("base64url");
    await store.putAuthorizationRequest({
      requestId,
      installationId,
      clientId,
      redirectUri,
      resource,
      scopes,
      state: requestState,
      codeChallenge,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const dashboardUrl = new URL(
      `/extensions/app/${encodeURIComponent(installation.settings.appId)}/authorize`,
      installation.settings.dashboardOrigin,
    );
    dashboardUrl.searchParams.set("request", requestId);
    return response.redirect(302, dashboardUrl.toString());
  } catch (error) {
    if (error instanceof OAuthRequestError) {
      if (safeRedirectUri) {
        const target = new URL(safeRedirectUri);
        target.searchParams.set("error", error.oauthError);
        target.searchParams.set("error_description", error.message);
        if (requestState) target.searchParams.set("state", requestState);
        return response.redirect(302, target.toString());
      }
      return response.status(error.status).json({
        error: error.oauthError,
        error_description: error.message,
      });
    }
    throw error;
  }
}
