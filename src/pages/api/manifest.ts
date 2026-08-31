import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import type { AppManifest, AppPermission } from "@saleor/app-sdk/types";

import packageJson from "../../../package.json";

const permissions: AppPermission[] = [
  "MANAGE_CHECKOUTS",
  "HANDLE_CHECKOUTS",
  "HANDLE_TAXES",
  "MANAGE_TAXES",
  "MANAGE_DISCOUNTS",
  "MANAGE_GIFT_CARD",
  "MANAGE_MENUS",
  "MANAGE_ORDERS",
  "MANAGE_ORDERS_IMPORT",
  "MANAGE_PAGES",
  "MANAGE_PAGE_TYPES_AND_ATTRIBUTES",
  "HANDLE_PAYMENTS",
  "MANAGE_PRODUCTS",
  "MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES",
  "MANAGE_SHIPPING",
  "MANAGE_TRANSLATIONS",
];

export default createManifestHandler({
  manifestFactory({ appBaseUrl }) {
    const iframeBaseUrl = process.env.APP_IFRAME_BASE_URL || appBaseUrl;
    const apiBaseUrl = process.env.APP_API_BASE_URL || appBaseUrl;
    const manifest: AppManifest = {
      id: "app.saleor.mcp",
      version: packageJson.version,
      name: "Saleor MCP",
      author: "Saleor Commerce",
      appUrl: `${iframeBaseUrl}/dashboard`,
      tokenTargetUrl: `${apiBaseUrl}/api/register`,
      permissions,
      webhooks: [],
      extensions: [],
      requiredSaleorVersion: ">=3.21 <4",
    };
    return manifest;
  },
});
