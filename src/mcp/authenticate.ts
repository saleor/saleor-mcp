import type { AuthData } from "@saleor/app-sdk/APL";

import {
  InstallationCredentialConfigurationError,
  verifyInstallationCredential,
} from "@/mcp/installation-credential";
import { saleorApp } from "@/saleor-app";

export class McpAuthenticationError extends Error {}

export async function authenticateMcpRequest(authorization: string | undefined): Promise<AuthData> {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new McpAuthenticationError("Missing MCP installation credential.");

  let identity;
  try {
    identity = await verifyInstallationCredential(match[1]);
  } catch (error) {
    if (error instanceof InstallationCredentialConfigurationError) throw error;
    throw new McpAuthenticationError("Invalid MCP installation credential.", { cause: error });
  }
  const authData = await saleorApp.apl.get(identity.saleorApiUrl);
  if (!authData || authData.appId !== identity.appId) {
    throw new McpAuthenticationError("This Saleor app installation is no longer active.");
  }
  return authData;
}
