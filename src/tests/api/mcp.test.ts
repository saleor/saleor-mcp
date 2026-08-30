import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mcpResource } from "@/oauth/config";
import { registerInstallation } from "@/oauth/installations";
import { MemoryOAuthStore, setOAuthStoreForTests } from "@/oauth/store";
import { issueAccessToken } from "@/oauth/tokens";
import { handleMcpRequest } from "@/pages/api/mcp";
import { saleorApp } from "@/saleor-app";

function request(method: string, authorization?: string): NextApiRequest {
  return {
    method,
    headers: {
      authorization,
      host: "mcp.example.com",
      "x-forwarded-proto": "https",
    },
  } as unknown as NextApiRequest;
}

function response() {
  let statusCode = 200;
  let body: unknown;
  const res = {
    setHeader: vi.fn(),
    status: vi.fn((status: number) => {
      statusCode = status;
      return res;
    }),
    json: vi.fn((value: unknown) => {
      body = value;
      return res;
    }),
    on: vi.fn(),
  } as unknown as NextApiResponse;
  return { res, statusCode: () => statusCode, body: () => body };
}

describe("MCP HTTP route", () => {
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

  it("allows only POST requests", async () => {
    const target = response();
    await handleMcpRequest(request("GET"), target.res, "a".repeat(32));
    expect(target.statusCode()).toBe(405);
    expect(target.res.setHeader).toHaveBeenCalledWith("Allow", "POST");
  });

  it("returns an OAuth discovery challenge for a missing or invalid access token", async () => {
    const installationId = "a".repeat(32);
    const missing = response();
    await handleMcpRequest(request("POST"), missing.res, installationId);
    expect(missing.statusCode()).toBe(401);
    expect(missing.body()).toMatchObject({ error: { code: -32001 } });
    expect(missing.res.setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate",
      expect.stringContaining(
        `Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp/${installationId}", scope="saleor:connection:read`,
      ),
    );

    const invalid = response();
    await handleMcpRequest(request("POST", "Bearer not-a-jwt"), invalid.res, installationId);
    expect(invalid.statusCode()).toBe(401);
    expect(invalid.body()).toMatchObject({
      error: { message: "Invalid or expired MCP access token." },
    });
  });

  it("returns 500 when installation storage is unavailable", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-token",
    };
    vi.spyOn(saleorApp.apl, "get").mockRejectedValue(new Error("DynamoDB unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const installationId = await registerInstallation(
      authData,
      "https://dashboard.saleor.cloud",
      store,
    );
    const { accessToken } = await issueAccessToken({
      baseUrl: "https://mcp.example.com",
      installationId,
      saleorApiUrl: authData.saleorApiUrl,
      appId: authData.appId,
      subject: "subject",
      userEmail: "staff@example.com",
      saleorPermissions: [],
      scopes: [],
      audience: mcpResource("https://mcp.example.com", installationId),
      clientId: "client",
    });

    const target = response();
    await handleMcpRequest(request("POST", `Bearer ${accessToken}`), target.res, installationId);

    expect(target.statusCode()).toBe(500);
    expect(target.body()).toMatchObject({
      error: { code: -32603, message: "Internal server error" },
    });
  });

  it("returns 500 when the OAuth signing secret is misconfigured", async () => {
    vi.stubEnv("MCP_OAUTH_SECRET", "short");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const target = response();
    await handleMcpRequest(request("POST", "Bearer credential"), target.res, "a".repeat(32));

    expect(target.statusCode()).toBe(500);
    expect(target.body()).toMatchObject({
      error: { code: -32603, message: "Internal server error" },
    });
  });
});
