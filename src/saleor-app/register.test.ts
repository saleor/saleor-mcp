import { describe, expect, it } from "vitest";

import { createAllowedSaleorUrls } from "./register";

describe("registration domain filter", () => {
  it("allows every installation when no pattern is configured", () => {
    expect(createAllowedSaleorUrls(undefined)).toEqual([]);
  });

  it("requires the configured pattern to match the complete Saleor API URL", () => {
    const [isAllowed] = createAllowedSaleorUrls("https://[a-z0-9-]+\\.saleor\\.cloud/graphql/");
    expect(isAllowed("https://demo.saleor.cloud/graphql/")).toBe(true);
    expect(isAllowed("https://demo.saleor.cloud/graphql/extra")).toBe(false);
  });

  it("fails early for an invalid regular expression", () => {
    expect(() => createAllowedSaleorUrls("[")).toThrow();
  });
});
