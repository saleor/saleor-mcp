import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "./proxy";

describe("web content security policy", () => {
  it("uses a nonce instead of allowing inline production scripts or styles", () => {
    const policy = buildContentSecurityPolicy("nonce-value", false);

    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-nonce-value'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
