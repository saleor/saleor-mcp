import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";

import { saleorApp } from "@/saleor-app";

export function createAllowedSaleorUrls(pattern: string | undefined) {
  if (!pattern) return [];
  const allowedUrl = new RegExp(`^(?:${pattern})$`);
  return [(saleorApiUrl: string) => allowedUrl.test(saleorApiUrl)];
}

const allowedSaleorUrls = createAllowedSaleorUrls(process.env.ALLOWED_DOMAIN_PATTERN);

export default createAppRegisterHandler({
  apl: saleorApp.apl,
  allowedSaleorUrls,
});
