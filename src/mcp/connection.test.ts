import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubCredentialKeys } from "@/tests/credential-keys";

import { buildConnectionDetails } from "./connection";
import { verifyInstallationCredential } from "./installation-credential";

describe("connection details", () => {
  beforeEach(stubCredentialKeys);
  afterEach(() => vi.unstubAllEnvs());

  it("builds an HTTP MCP config without exposing the Saleor app token", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-token",
    };
    const details = await buildConnectionDetails(authData, "https://app.example.com", {
      SALEOR_MCP_MODE: "read_write",
    });

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
    );
    expect(details.mcpUrl).toBe("https://api.example/mcp");
  });
});
