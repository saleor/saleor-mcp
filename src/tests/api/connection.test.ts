import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildConnectionDetails } from "@/pages/api/connection";

describe("connection details", () => {
  beforeEach(() => vi.stubEnv("MCP_OAUTH_SECRET", "a-secret-with-at-least-thirty-two-characters"));
  afterEach(() => vi.unstubAllEnvs());

  it("builds a per-installation OAuth MCP config without any bearer token", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-token",
    };
    const details = await buildConnectionDetails(authData, "https://app.example.com", {
      SALEOR_MCP_MODE: "read_write",
    });

    expect(details).toMatchObject({
      mode: "read_write",
      config: {
        mcpServers: {
          saleor: { type: "http" },
        },
      },
    });
    expect(details.mcpUrl).toBe(`https://app.example.com/mcp/${details.installationId}`);
    expect(JSON.stringify(details)).not.toContain(authData.token);
    expect(JSON.stringify(details)).not.toContain("Authorization");
  });

  it("uses the explicit API base URL when one is configured", async () => {
    const details = await buildConnectionDetails(
      { appId: "app", saleorApiUrl: "https://shop.example/graphql/", token: "token" },
      "https://iframe.example",
      { APP_API_BASE_URL: "https://api.example" },
    );
    expect(details.mcpUrl).toBe(`https://api.example/mcp/${details.installationId}`);
  });
});
