import { describe, expect, it } from "vitest";

import { DEFAULT_BLOCKED_MUTATIONS, getPolicyConfig } from "./config";

describe("getPolicyConfig", () => {
  it("defaults to read_only", () => {
    const policy = getPolicyConfig({});
    expect(policy.mode).toBe("read_only");
    expect(policy.effectiveBlocklist.size).toBe(0);
  });

  it("uses the default blocklist in read_write", () => {
    const policy = getPolicyConfig({ SALEOR_MCP_MODE: "read_write" });
    expect(policy.mode).toBe("read_write");
    for (const name of DEFAULT_BLOCKED_MUTATIONS)
      expect(policy.effectiveBlocklist.has(name)).toBe(true);
  });

  it("applies allowed and extra blocked overrides", () => {
    const policy = getPolicyConfig({
      SALEOR_MCP_MODE: "read_write",
      SALEOR_MCP_ALLOWED_MUTATIONS: "staffDelete, appDelete",
      SALEOR_MCP_BLOCKED_MUTATIONS: "productDelete",
    });
    expect(policy.effectiveBlocklist.has("staffDelete")).toBe(false);
    expect(policy.effectiveBlocklist.has("appDelete")).toBe(false);
    expect(policy.effectiveBlocklist.has("productDelete")).toBe(true);
  });

  it("has no blocklist in unrestricted mode", () => {
    expect(getPolicyConfig({ SALEOR_MCP_MODE: "unrestricted" }).effectiveBlocklist.size).toBe(0);
  });

  it("rejects an invalid mode", () => {
    expect(() => getPolicyConfig({ SALEOR_MCP_MODE: "bogus" })).toThrow("Invalid SALEOR_MCP_MODE");
  });
});
