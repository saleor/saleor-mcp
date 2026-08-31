import type { AuthData } from "@saleor/app-sdk/APL";

import {
  InstallationCredentialConfigurationError,
  verifyInstallationCredential,
} from "@/mcp/installation-credential";
import { saleorApp } from "@/saleor-app";

export class McpAuthenticationError extends Error {}

function bearerCredential(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;

  const separator = authorization.indexOf(" ");
  if (separator <= 0 || authorization.slice(0, separator).toLowerCase() !== "bearer") {
    return undefined;
  }

  const credential = authorization.slice(separator + 1);
  if (!credential) return undefined;
  for (const character of credential) {
    if (!character.trim()) return undefined;
  }

  return credential;
}

export async function authenticateMcpRequest(authorization: string | undefined): Promise<AuthData> {
  const credential = bearerCredential(authorization);
  if (!credential) throw new McpAuthenticationError("Missing MCP installation credential.");

  let identity;
  try {
    identity = await verifyInstallationCredential(credential);
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
