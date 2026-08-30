import type { NextApiRequest, NextApiResponse } from "next";

import { getPublicBaseUrl, oauthIssuer } from "@/oauth/config";
import { resolveInstallation } from "@/oauth/installations";
import { getSupportedOAuthScopes } from "@/oauth/scopes";
import { getOAuthStore } from "@/oauth/store";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "method_not_allowed" });
  }
  const installationId = Array.isArray(request.query.installationId)
    ? request.query.installationId[0]
    : request.query.installationId;
  if (!installationId || !(await resolveInstallation(installationId, getOAuthStore()))) {
    return response.status(404).json({ error: "invalid_request" });
  }
  const issuer = oauthIssuer(getPublicBaseUrl(request), installationId);
  response.setHeader("Cache-Control", "public, max-age=300");
  return response.status(200).json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    revocation_endpoint: `${issuer}/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: getSupportedOAuthScopes(),
    client_id_metadata_document_supported: false,
  });
}
