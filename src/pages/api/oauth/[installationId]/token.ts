import { createHash, timingSafeEqual } from "node:crypto";

import type { NextApiRequest, NextApiResponse } from "next";

import { getPublicBaseUrl, mcpResource } from "@/oauth/config";
import { resolveInstallation } from "@/oauth/installations";
import { parseRequestedScopes } from "@/oauth/scopes";
import { getOAuthStore } from "@/oauth/store";
import { hashOpaqueToken, issueTokenPair } from "@/oauth/tokens";
import { formBody, noStore, OAuthRequestError, validateCodeVerifier } from "@/oauth/validation";

function oauthError(response: NextApiResponse, error: unknown) {
  if (error instanceof OAuthRequestError) {
    return response.status(error.status).json({
      error: error.oauthError,
      error_description: error.message,
    });
  }
  throw error;
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
  const installation = installationId
    ? await resolveInstallation(installationId, store)
    : undefined;
  if (!installationId || !installation) {
    return response.status(400).json({ error: "invalid_grant" });
  }
  if (request.headers.authorization) {
    return response.status(401).json({
      error: "invalid_client",
      error_description: "This endpoint accepts public clients without client authentication.",
    });
  }
  try {
    const body = formBody(request.body);
    const grantType = body.get("grant_type");
    const clientId = body.get("client_id");
    if (!clientId || !(await store.getClient(installationId, clientId))) {
      throw new OAuthRequestError("invalid_client", "Unknown OAuth client.", 401);
    }
    const expectedResource = mcpResource(getPublicBaseUrl(request), installationId);
    const resource = body.get("resource");
    if (resource !== expectedResource) {
      throw new OAuthRequestError(
        "invalid_target",
        "resource must exactly identify this MCP endpoint.",
      );
    }

    if (grantType === "authorization_code") {
      const code = body.get("code");
      const redirectUri = body.get("redirect_uri");
      const verifier = body.get("code_verifier");
      if (!code || !redirectUri || !verifier) {
        throw new OAuthRequestError(
          "invalid_request",
          "code, redirect_uri, and code_verifier are required.",
        );
      }
      validateCodeVerifier(verifier);
      const grant = await store.consumeAuthorizationCode(hashOpaqueToken(code));
      if (
        !grant ||
        grant.installationId !== installationId ||
        grant.clientId !== clientId ||
        grant.redirectUri !== redirectUri ||
        grant.resource !== resource
      ) {
        throw new OAuthRequestError(
          "invalid_grant",
          "Authorization code is invalid, expired, or already used.",
        );
      }
      const actualChallenge = createHash("sha256").update(verifier).digest("base64url");
      const actual = Buffer.from(actualChallenge);
      const expected = Buffer.from(grant.codeChallenge);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw new OAuthRequestError("invalid_grant", "PKCE verification failed.");
      }
      return response.status(200).json(
        await issueTokenPair(
          {
            baseUrl: getPublicBaseUrl(request),
            installationId,
            saleorApiUrl: installation.authData.saleorApiUrl,
            appId: installation.authData.appId,
            subject: grant.subject,
            userEmail: grant.userEmail,
            saleorPermissions: grant.saleorPermissions,
            scopes: grant.scopes,
            audience: resource,
            clientId,
          },
          store,
        ),
      );
    }

    if (grantType === "refresh_token") {
      const token = body.get("refresh_token");
      if (!token) throw new OAuthRequestError("invalid_request", "refresh_token is required.");
      const grant = await store.consumeRefreshToken(hashOpaqueToken(token));
      if (
        !grant ||
        grant.installationId !== installationId ||
        grant.clientId !== clientId ||
        grant.resource !== resource
      ) {
        throw new OAuthRequestError(
          "invalid_grant",
          "Refresh token is invalid, expired, or already used.",
        );
      }
      let scopes = grant.scopes;
      const requestedScope = body.get("scope");
      if (requestedScope !== null) {
        try {
          scopes = parseRequestedScopes(requestedScope);
        } catch {
          throw new OAuthRequestError(
            "invalid_scope",
            "One or more requested scopes are not supported.",
          );
        }
        const originallyGranted = new Set(grant.scopes);
        if (scopes.some((scope) => !originallyGranted.has(scope))) {
          throw new OAuthRequestError(
            "invalid_scope",
            "A refresh cannot increase its granted scopes.",
          );
        }
      }
      return response.status(200).json(
        await issueTokenPair(
          {
            baseUrl: getPublicBaseUrl(request),
            installationId,
            saleorApiUrl: installation.authData.saleorApiUrl,
            appId: installation.authData.appId,
            subject: grant.subject,
            userEmail: grant.userEmail,
            saleorPermissions: grant.saleorPermissions,
            scopes,
            audience: resource,
            clientId,
          },
          store,
        ),
      );
    }

    throw new OAuthRequestError("unsupported_grant_type", "Unsupported grant_type.");
  } catch (error) {
    return oauthError(response, error);
  }
}
