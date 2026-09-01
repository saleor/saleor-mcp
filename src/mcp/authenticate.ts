import type { AuthData } from "@saleor/app-sdk/APL";

import {
  ExpiredInstallationCredentialError,
  InactiveInstallationCredentialError,
  InstallationCredentialConfigurationError,
  InvalidInstallationCredentialError,
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

  try {
    return await verifyInstallationCredential(credential, (saleorApiUrl) =>
      saleorApp.apl.get(saleorApiUrl),
    );
  } catch (error) {
    if (error instanceof InstallationCredentialConfigurationError) throw error;
    if (error instanceof ExpiredInstallationCredentialError) {
      throw new McpAuthenticationError(error.message, { cause: error });
    }
    if (error instanceof InactiveInstallationCredentialError) {
      throw new McpAuthenticationError(error.message, { cause: error });
    }
    if (error instanceof InvalidInstallationCredentialError) {
      throw new McpAuthenticationError("Invalid MCP installation credential.", { cause: error });
    }
    throw error;
  }
}
