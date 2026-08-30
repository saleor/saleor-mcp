import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyInstallationCredential } from "@/lib/installation-credential";
import type { PolicyConfig } from "@/mcp/config";
import { buildConnectionDetails } from "@/pages/api/connection";

const scopeFields: Pick<PolicyConfig, "enabledScopes" | "defaultScopes"> = {
  enabledScopes: new Set(),
  defaultScopes: new Set(),
};

describe("connection details", () => {
  beforeEach(() =>
    vi.stubEnv("MCP_CREDENTIAL_SECRET", "a-secret-with-at-least-thirty-two-characters"),
  );
  afterEach(() => vi.unstubAllEnvs());

  it("builds an HTTP MCP config without exposing the Saleor app token", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-token",
    };
    const details = await buildConnectionDetails(
      authData,
      "https://app.example.com",
      {
        APP_API_BASE_URL: undefined,
      },
      async () => ({
        ...scopeFields,
        mode: "read_write",
        allowedMutations: new Set(["productCreate"]),
      }),
    );

    expect(details).toMatchObject({
      mcpUrl: "https://app.example.com/mcp",
      mode: "read_write",
      config: {
        mcpServers: {
          saleor: { type: "http", url: "https://app.example.com/mcp" },
        },
      },
    });
    expect(JSON.stringify(details)).not.toContain(authData.token);
    await expect(verifyInstallationCredential(details.credential)).resolves.toEqual({
      appId: authData.appId,
      saleorApiUrl: authData.saleorApiUrl,
    });
  });

  it("uses the explicit API base URL when one is configured", async () => {
    const details = await buildConnectionDetails(
      { appId: "app", saleorApiUrl: "https://shop.example/graphql/", token: "token" },
      "https://iframe.example",
      { APP_API_BASE_URL: "https://api.example" },
      async () => ({ ...scopeFields, mode: "read_only", allowedMutations: new Set() }),
    );
    expect(details.mcpUrl).toBe("https://api.example/mcp");
  });
});
