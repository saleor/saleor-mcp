import { describe, expect, it } from "vitest";

import { getPolicyConfig } from "./config";

describe("getPolicyConfig", () => {
  it("defaults to read_only", () => {
    const policy = getPolicyConfig({});
    expect(policy.mode).toBe("read_only");
    expect(policy.allowedMutations.size).toBe(0);
  });

  it("fails closed with an empty allowlist in read_write", () => {
    const policy = getPolicyConfig({ SALEOR_MCP_MODE: "read_write" });
    expect(policy.mode).toBe("read_write");
    expect(policy.allowedMutations.size).toBe(0);
  });

  it("parses the explicit mutation allowlist", () => {
    const policy = getPolicyConfig({
      SALEOR_MCP_MODE: "read_write",
      SALEOR_MCP_ALLOWED_MUTATIONS: "productCreate, productUpdate, productCreate",
    });
    expect([...policy.allowedMutations]).toEqual(["productCreate", "productUpdate"]);
  });

  it("keeps the allowlist visible in unrestricted mode", () => {
    expect(
      getPolicyConfig({
        SALEOR_MCP_MODE: "unrestricted",
        SALEOR_MCP_ALLOWED_MUTATIONS: "productCreate",
      }).allowedMutations,
    ).toEqual(new Set(["productCreate"]));
  });

  it("rejects an invalid mode", () => {
    expect(() => getPolicyConfig({ SALEOR_MCP_MODE: "bogus" })).toThrow("Invalid SALEOR_MCP_MODE");
  });
});
