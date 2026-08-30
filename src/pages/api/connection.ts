import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import type { AuthData } from "@saleor/app-sdk/APL";

import { getPolicyConfig } from "@/mcp/config";
import { canonicalUrl, deriveInstallationId, mcpResource } from "@/oauth/config";
import { saleorApp } from "@/saleor-app";

export async function buildConnectionDetails(
  authData: AuthData,
  baseUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const installationId = deriveInstallationId(authData, { ...process.env, ...env });
  const mcpUrl = mcpResource(canonicalUrl(env.APP_API_BASE_URL || baseUrl), installationId);
  const policy = getPolicyConfig(env);

  return {
    saleorApiUrl: authData.saleorApiUrl,
    mcpUrl,
    mode: policy.mode,
    installationId,
    config: {
      mcpServers: {
        saleor: {
          type: "http",
          url: mcpUrl,
        },
      },
    },
  };
}

export default createProtectedHandler(
  async (request, response, context) => {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      return response.status(405).json({ error: "Method not allowed" });
    }

    return response
      .status(200)
      .json(await buildConnectionDetails(context.authData, context.baseUrl));
  },
  saleorApp.apl,
  ["MANAGE_APPS"],
);
