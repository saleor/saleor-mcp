import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";

import { saleorApp } from "@/saleor-app";

export function createAllowedSaleorUrls(pattern: string | undefined) {
  if (!pattern) return [() => false];
  const allowedUrl = new RegExp(`^(?:${pattern})$`);
  return [(saleorApiUrl: string) => allowedUrl.test(saleorApiUrl)];
}

export function createRegisterHandler(pattern: string | undefined) {
  return createAppRegisterHandler({
    apl: saleorApp.apl,
    allowedSaleorUrls: createAllowedSaleorUrls(pattern),
  });
}

export default createRegisterHandler(process.env.ALLOWED_DOMAIN_PATTERN);
