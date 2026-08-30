import type { NextApiRequest, NextApiResponse } from "next";

import { getPublicBaseUrl, mcpResource, oauthIssuer } from "@/oauth/config";
import { resolveInstallation } from "@/oauth/installations";
import { getDefaultOAuthScopes } from "@/oauth/scopes";
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
    return response.status(404).json({ error: "unknown_resource" });
  }
  const baseUrl = getPublicBaseUrl(request);
  response.setHeader("Cache-Control", "public, max-age=300");
  return response.status(200).json({
    resource: mcpResource(baseUrl, installationId),
    authorization_servers: [oauthIssuer(baseUrl, installationId)],
    bearer_methods_supported: ["header"],
    scopes_supported: getDefaultOAuthScopes(),
  });
}
