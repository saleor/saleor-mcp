import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deriveInstallationId, mcpResource } from "@/oauth/config";
import { registerInstallation } from "@/oauth/installations";
import { MemoryOAuthStore, setOAuthStoreForTests } from "@/oauth/store";
import { issueAccessToken } from "@/oauth/tokens";
import { saleorApp } from "@/saleor-app";

import { authenticateMcpRequest } from "./authenticate";

describe("MCP request authentication", () => {
  const baseUrl = "https://mcp.example.com";
  let store: MemoryOAuthStore;

  beforeEach(() => {
    vi.stubEnv("MCP_OAUTH_SECRET", "a-secret-with-at-least-thirty-two-characters");
    store = new MemoryOAuthStore();
    setOAuthStoreForTests(store);
  });
  afterEach(() => {
    setOAuthStoreForTests(undefined);
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("accepts only a minted, audience-bound MCP token and resolves the server app token", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-token",
    };
    vi.spyOn(saleorApp.apl, "get").mockResolvedValue(authData);
    const installationId = await registerInstallation(
      authData,
      "https://dashboard.saleor.cloud",
      store,
    );
    const resource = mcpResource(baseUrl, installationId);
    const { accessToken } = await issueAccessToken({
      baseUrl,
      installationId,
      saleorApiUrl: authData.saleorApiUrl,
      appId: authData.appId,
      subject: "user-subject",
      userEmail: "staff@example.com",
      saleorPermissions: ["MANAGE_PRODUCTS"],
      scopes: ["saleor:catalog:read"],
      audience: resource,
      clientId: "client-1",
    });

    const result = await authenticateMcpRequest(`Bearer ${accessToken}`, {
      baseUrl,
      installationId,
    });
    expect(result.authData).toEqual(authData);
    expect(result.principal).toMatchObject({
      subject: "user-subject",
      installationId,
      userEmail: "staff@example.com",
      scopes: ["saleor:catalog:read"],
    });
    expect(accessToken).not.toContain(authData.token);
  });

  it("rejects missing, wrong-audience, and revoked credentials", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-only-token",
    };
    vi.spyOn(saleorApp.apl, "get").mockResolvedValue(authData);
    const installationId = await registerInstallation(
      authData,
      "https://dashboard.saleor.cloud",
      store,
    );
    await expect(authenticateMcpRequest(undefined, { baseUrl, installationId })).rejects.toThrow(
      "Missing MCP access token",
    );

    const wrongAudience = await issueAccessToken({
      baseUrl,
      installationId,
      saleorApiUrl: authData.saleorApiUrl,
      appId: authData.appId,
      subject: "subject",
      userEmail: "staff@example.com",
      saleorPermissions: [],
      scopes: [],
      audience: "https://mcp.example.com/a-different-resource",
      clientId: "client",
    });
    await expect(
      authenticateMcpRequest(`Bearer ${wrongAudience.accessToken}`, { baseUrl, installationId }),
    ).rejects.toThrow("Invalid or expired");

    const valid = await issueAccessToken({
      baseUrl,
      installationId,
      saleorApiUrl: authData.saleorApiUrl,
      appId: authData.appId,
      subject: "subject",
      userEmail: "staff@example.com",
      saleorPermissions: [],
      scopes: [],
      audience: mcpResource(baseUrl, installationId),
      clientId: "client",
    });
    await store.revokeAccessToken(valid.tokenId, valid.expiresAt * 1000);
    await expect(
      authenticateMcpRequest(`Bearer ${valid.accessToken}`, { baseUrl, installationId }),
    ).rejects.toThrow("Invalid or expired");
  });

  it("rejects a token after the app installation identity changes", async () => {
    const original = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "old-server-token",
    };
    const installationId = deriveInstallationId(original);
    await store.putInstallation({
      installationId,
      saleorApiUrl: original.saleorApiUrl,
      appId: original.appId,
      dashboardOrigin: "https://dashboard.saleor.cloud",
      updatedAt: Date.now(),
    });
    vi.spyOn(saleorApp.apl, "get").mockResolvedValue({ ...original, appId: "reinstalled-app" });
    const token = await issueAccessToken({
      baseUrl,
      installationId,
      saleorApiUrl: original.saleorApiUrl,
      appId: original.appId,
      subject: "subject",
      userEmail: "staff@example.com",
      saleorPermissions: [],
      scopes: [],
      audience: mcpResource(baseUrl, installationId),
      clientId: "client",
    });
    await expect(
      authenticateMcpRequest(`Bearer ${token.accessToken}`, { baseUrl, installationId }),
    ).rejects.toThrow("no longer active");
  });
});
