import type { NextApiRequest, NextApiResponse } from "next";

import { getPublicBaseUrl, mcpResource } from "@/oauth/config";
import { resolveInstallation } from "@/oauth/installations";
import { getOAuthStore } from "@/oauth/store";
import { hashOpaqueToken, unsafeAccessTokenClaims, verifyAccessToken } from "@/oauth/tokens";
import { formBody, noStore } from "@/oauth/validation";

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
    return response.status(200).end();
  }
  const body = formBody(request.body);
  const token = body.get("token");
  const clientId = body.get("client_id");
  if (!token || !clientId || !(await store.getClient(installationId, clientId))) {
    return response.status(200).end();
  }

  if (token.startsWith("mcp_rt_")) {
    await store.deleteRefreshToken(hashOpaqueToken(token));
    return response.status(200).end();
  }
  try {
    const claims = unsafeAccessTokenClaims(token);
    if (claims.client_id !== clientId) return response.status(200).end();
    const principal = await verifyAccessToken(token, {
      baseUrl: getPublicBaseUrl(request),
      installationId,
      resource: mcpResource(getPublicBaseUrl(request), installationId),
    });
    await store.revokeAccessToken(principal.tokenId, principal.expiresAt * 1000);
  } catch {
    // RFC 7009 intentionally does not reveal whether the token was valid.
  }
  return response.status(200).end();
}
