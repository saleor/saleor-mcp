import { describe, expect, it } from "vitest";

import { buildManifest } from "@/pages/api/manifest";

describe("app manifest", () => {
  it("installs without Saleor permissions", () => {
    expect(buildManifest("https://app.example.com").permissions).toEqual([]);
  });

  it("keeps iframe and API URL overrides separate", () => {
    const manifest = buildManifest("https://fallback.example.com", {
      APP_IFRAME_BASE_URL: "https://iframe.example.com",
      APP_API_BASE_URL: "https://api.example.com",
    });

    expect(manifest.appUrl).toBe("https://iframe.example.com/dashboard");
    expect(manifest.tokenTargetUrl).toBe("https://api.example.com/api/register");
  });
});
