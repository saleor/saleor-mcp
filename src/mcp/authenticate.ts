import type { AuthData } from "@saleor/app-sdk/APL";

import { mcpResource, OAuthConfigurationError } from "@/oauth/config";
import { resolveInstallation } from "@/oauth/installations";
import { getOAuthStore } from "@/oauth/store";
import { type McpPrincipal, verifyAccessToken } from "@/oauth/tokens";

export class McpAuthenticationError extends Error {}

export type AuthenticatedMcpRequest = { authData: AuthData; principal: McpPrincipal };

export async function authenticateMcpRequest(
  authorization: string | undefined,
  context: { baseUrl: string; installationId: string },
): Promise<AuthenticatedMcpRequest> {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new McpAuthenticationError("Missing MCP access token.");

  const store = getOAuthStore();
  let principal: McpPrincipal;
  try {
    principal = await verifyAccessToken(match[1], {
      baseUrl: context.baseUrl,
      installationId: context.installationId,
      resource: mcpResource(context.baseUrl, context.installationId),
    });
    if (await store.isAccessTokenRevoked(principal.tokenId)) {
      throw new Error("Access token was revoked.");
    }
  } catch (error) {
    if (error instanceof OAuthConfigurationError) throw error;
    throw new McpAuthenticationError("Invalid or expired MCP access token.", { cause: error });
  }
  const installation = await resolveInstallation(context.installationId, store);
  const authData = installation?.authData;
  if (
    !authData ||
    authData.saleorApiUrl !== principal.saleorApiUrl ||
    authData.appId !== principal.appId
  ) {
    throw new McpAuthenticationError("This Saleor app installation is no longer active.");
  }
  // The server-side Saleor app token is loaded from the APL. The Dashboard user JWT
  // and the minted MCP access token are never passed through to Saleor.
  return { authData, principal };
}
