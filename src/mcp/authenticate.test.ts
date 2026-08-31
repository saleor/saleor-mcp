import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { issueInstallationCredential } from "@/mcp/installation-credential";
import { saleorApp } from "@/saleor-app";

import { authenticateMcpRequest } from "./authenticate";

describe("MCP request authentication", () => {
  beforeEach(() =>
    vi.stubEnv("MCP_CREDENTIAL_SECRET", "a-secret-with-at-least-thirty-two-characters"),
  );
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("resolves the server-side app token through the APL", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-token",
    };
    vi.spyOn(saleorApp.apl, "get").mockResolvedValue(authData);
    const credential = await issueInstallationCredential(authData);
    await expect(authenticateMcpRequest(`Bearer ${credential}`)).resolves.toEqual(authData);
  });

  it("rejects missing credentials and an old app installation ID", async () => {
    await expect(authenticateMcpRequest(undefined)).rejects.toThrow(
      "Missing MCP installation credential",
    );
    const credential = await issueInstallationCredential({
      appId: "old-app",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "not-encoded",
    });
    vi.spyOn(saleorApp.apl, "get").mockResolvedValue({
      appId: "new-app",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "new-token",
    });
    await expect(authenticateMcpRequest(`Bearer ${credential}`)).rejects.toThrow(
      "no longer active",
    );
  });
});
