import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import type { AppManifest } from "@saleor/app-sdk/types";

import packageJson from "../../../package.json";

export function buildManifest(
  appBaseUrl: string,
  env: Record<string, string | undefined> = process.env,
): AppManifest {
  const iframeBaseUrl = env.APP_IFRAME_BASE_URL || appBaseUrl;
  const apiBaseUrl = env.APP_API_BASE_URL || appBaseUrl;

  return {
    id: "app.saleor.mcp",
    version: packageJson.version,
    name: "Saleor MCP",
    author: "Saleor Commerce",
    appUrl: `${iframeBaseUrl}/dashboard`,
    tokenTargetUrl: `${apiBaseUrl}/api/register`,
    permissions: [],
    webhooks: [],
    extensions: [],
    requiredSaleorVersion: ">=3.21 <4",
  };
}

export default createManifestHandler({
  manifestFactory({ appBaseUrl }) {
    return buildManifest(appBaseUrl);
  },
});
