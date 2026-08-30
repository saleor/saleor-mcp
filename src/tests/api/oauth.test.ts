import { createHash } from "node:crypto";

import type { AuthData } from "@saleor/app-sdk/APL";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authenticateMcpRequest } from "@/mcp/authenticate";
import { mcpResource } from "@/oauth/config";
import { registerInstallation } from "@/oauth/installations";
import { MemoryOAuthStore, setOAuthStoreForTests } from "@/oauth/store";
import authorizationServerHandler from "@/pages/api/oauth/[installationId]/authorization-server";
import authorizeHandler from "@/pages/api/oauth/[installationId]/authorize";
import protectedResourceHandler from "@/pages/api/oauth/[installationId]/protected-resource";
import registerHandler from "@/pages/api/oauth/[installationId]/register";
import revokeHandler from "@/pages/api/oauth/[installationId]/revoke";
import tokenHandler from "@/pages/api/oauth/[installationId]/token";
import { consentHandler } from "@/pages/api/oauth/consent";
import { saleorApp } from "@/saleor-app";

type CapturedResponse = {
  response: NextApiResponse;
  status: () => number;
  body: () => Record<string, unknown>;
  redirect: () => string | undefined;
  headers: Map<string, string>;
};

function response(): CapturedResponse {
  let statusCode = 200;
  let body: unknown;
  let redirect: string | undefined;
  const headers = new Map<string, string>();
  const target = {
    setHeader: vi.fn((name: string, value: string) => headers.set(name.toLowerCase(), value)),
    status: vi.fn((status: number) => {
      statusCode = status;
      return target;
    }),
    json: vi.fn((value: unknown) => {
      body = value;
      return target;
    }),
    redirect: vi.fn((status: number, value: string) => {
      statusCode = status;
      redirect = value;
      return target;
    }),
    end: vi.fn(() => target),
  } as unknown as NextApiResponse;
  return {
    response: target,
    status: () => statusCode,
    body: () => body as Record<string, unknown>,
    redirect: () => redirect,
    headers,
  };
}

function request(
  method: string,
  installationId: string,
  options: { query?: Record<string, string>; body?: unknown; authorization?: string } = {},
) {
  return {
    method,
    query: { installationId, ...options.query },
    body: options.body,
    headers: {
      host: "mcp.example.com",
      "x-forwarded-proto": "https",
      ...(options.authorization ? { authorization: options.authorization } : {}),
    },
  } as unknown as NextApiRequest;
}

describe("OAuth authorization server", () => {
  const authData: AuthData = {
    appId: "saleor-app-id",
    saleorApiUrl: "https://shop.saleor.cloud/graphql/",
    token: "server-side-saleor-app-token",
  };
  const baseUrl = "https://mcp.example.com";
  const redirectUri = "http://127.0.0.1:49152/callback";
  const verifier = "a".repeat(64);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let store: MemoryOAuthStore;
  let installationId: string;

  beforeEach(async () => {
    vi.stubEnv("MCP_OAUTH_SECRET", "oauth-secret-with-at-least-thirty-two-characters");
    store = new MemoryOAuthStore();
    setOAuthStoreForTests(store);
    vi.spyOn(saleorApp.apl, "get").mockResolvedValue(authData);
    installationId = await registerInstallation(authData, "https://dashboard.saleor.cloud", store);
  });

  afterEach(() => {
    setOAuthStoreForTests(undefined);
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  async function registerClient() {
    const target = response();
    await registerHandler(
      request("POST", installationId, {
        body: {
          client_name: "Codex",
          redirect_uris: [redirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
      }),
      target.response,
    );
    expect(target.status()).toBe(201);
    return target.body().client_id as string;
  }

  async function beginAuthorization(clientId: string) {
    const target = response();
    await authorizeHandler(
      request("GET", installationId, {
        query: {
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          resource: mcpResource(baseUrl, installationId),
          code_challenge: challenge,
          code_challenge_method: "S256",
          scope: "saleor:catalog:read saleor:orders:write",
          state: "codex-state",
        },
      }),
      target.response,
    );
    expect(target.status()).toBe(302);
    const dashboardRedirect = new URL(target.redirect()!);
    expect(dashboardRedirect.origin).toBe("https://dashboard.saleor.cloud");
    expect(dashboardRedirect.pathname).toBe(
      `/extensions/app/${encodeURIComponent(authData.appId)}/authorize`,
    );
    return dashboardRedirect.searchParams.get("request")!;
  }

  async function approve(requestId: string) {
    const target = response();
    await consentHandler(
      request("POST", installationId, {
        body: { request: requestId, decision: "allow" },
        authorization: "Bearer dashboard-user-jwt-must-not-pass-through",
      }),
      target.response,
      {
        baseUrl,
        authData,
        user: { email: "staff@example.com", userPermissions: ["MANAGE_PRODUCTS"] },
      },
    );
    expect(target.status()).toBe(200);
    const callback = new URL(target.body().redirectTo as string);
    expect(callback.searchParams.get("state")).toBe("codex-state");
    return callback.searchParams.get("code")!;
  }

  async function exchangeCode(clientId: string, code: string, codeVerifier = verifier) {
    const target = response();
    await tokenHandler(
      request("POST", installationId, {
        body: {
          grant_type: "authorization_code",
          client_id: clientId,
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          resource: mcpResource(baseUrl, installationId),
        },
      }),
      target.response,
    );
    return target;
  }

  it("publishes protected-resource and authorization-server discovery for one installation", async () => {
    const resourceTarget = response();
    await protectedResourceHandler(request("GET", installationId), resourceTarget.response);
    expect(resourceTarget.body()).toMatchObject({
      resource: mcpResource(baseUrl, installationId),
      authorization_servers: [`${baseUrl}/oauth/${installationId}`],
      scopes_supported: expect.arrayContaining([
        "saleor:connection:read",
        "saleor:schema:read",
        "saleor:catalog:read",
      ]),
    });

    const serverTarget = response();
    await authorizationServerHandler(request("GET", installationId), serverTarget.response);
    expect(serverTarget.body()).toMatchObject({
      issuer: `${baseUrl}/oauth/${installationId}`,
      authorization_endpoint: `${baseUrl}/oauth/${installationId}/authorize`,
      registration_endpoint: `${baseUrl}/oauth/${installationId}/register`,
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
  });

  it("runs DCR, Dashboard consent, one-time PKCE exchange, and MCP authentication", async () => {
    const clientId = await registerClient();
    const requestId = await beginAuthorization(clientId);

    const preview = response();
    await consentHandler(
      request("GET", installationId, { query: { request: requestId } }),
      preview.response,
      {
        baseUrl,
        authData,
        user: { email: "staff@example.com", userPermissions: ["MANAGE_PRODUCTS"] },
      },
    );
    expect(preview.body()).toMatchObject({
      clientName: "Codex",
      requestedScopes: ["saleor:catalog:read", "saleor:orders:write"],
      grantableScopes: ["saleor:catalog:read"],
    });

    const code = await approve(requestId);
    const exchanged = await exchangeCode(clientId, code);
    expect(exchanged.status()).toBe(200);
    expect(exchanged.body()).toMatchObject({
      token_type: "Bearer",
      expires_in: 900,
      scope: "saleor:catalog:read",
    });
    expect(JSON.stringify(exchanged.body())).not.toContain(authData.token);
    expect(JSON.stringify(exchanged.body())).not.toContain("dashboard-user-jwt");

    const authenticated = await authenticateMcpRequest(`Bearer ${exchanged.body().access_token}`, {
      baseUrl,
      installationId,
    });
    expect(authenticated.authData.token).toBe(authData.token);
    expect(authenticated.principal).toMatchObject({
      userEmail: "staff@example.com",
      scopes: ["saleor:catalog:read"],
      saleorPermissions: ["MANAGE_PRODUCTS"],
    });

    const replay = await exchangeCode(clientId, code);
    expect(replay.status()).toBe(400);
    expect(replay.body().error).toBe("invalid_grant");
  });

  it("requires exact registered redirects/resources and rejects PKCE substitution", async () => {
    const clientId = await registerClient();
    const wrongRedirect = response();
    await authorizeHandler(
      request("GET", installationId, {
        query: {
          client_id: clientId,
          redirect_uri: `${redirectUri}?attacker=1`,
          response_type: "code",
          resource: mcpResource(baseUrl, installationId),
          code_challenge: challenge,
          code_challenge_method: "S256",
        },
      }),
      wrongRedirect.response,
    );
    expect(wrongRedirect.status()).toBe(400);
    expect(wrongRedirect.body().error_description).toContain("not registered");

    for (const insecureRedirect of [
      "http://attacker.example/callback",
      "https://client.example/callback#fragment",
    ]) {
      const unsafeRegistration = response();
      await registerHandler(
        request("POST", installationId, {
          body: { client_name: "Unsafe", redirect_uris: [insecureRedirect] },
        }),
        unsafeRegistration.response,
      );
      expect(unsafeRegistration.status()).toBe(400);
      expect(unsafeRegistration.body().error).toBe("invalid_redirect_uri");
    }

    const wrongResource = response();
    await authorizeHandler(
      request("GET", installationId, {
        query: {
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          resource: `${baseUrl}/mcp/another-installation`,
          code_challenge: challenge,
          code_challenge_method: "S256",
        },
      }),
      wrongResource.response,
    );
    expect(wrongResource.status()).toBe(302);
    expect(new URL(wrongResource.redirect()!).searchParams.get("error")).toBe("invalid_target");

    const code = await approve(await beginAuthorization(clientId));
    const substituted = await exchangeCode(clientId, code, "b".repeat(64));
    expect(substituted.status()).toBe(400);
    expect(substituted.body()).toMatchObject({ error: "invalid_grant" });
  });

  it("rotates refresh tokens and supports access-token revocation", async () => {
    const clientId = await registerClient();
    const exchanged = await exchangeCode(
      clientId,
      await approve(await beginAuthorization(clientId)),
    );
    const originalRefreshToken = exchanged.body().refresh_token as string;
    const refresh = response();
    await tokenHandler(
      request("POST", installationId, {
        body: {
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: originalRefreshToken,
          resource: mcpResource(baseUrl, installationId),
        },
      }),
      refresh.response,
    );
    expect(refresh.status()).toBe(200);
    expect(refresh.body().refresh_token).not.toBe(originalRefreshToken);

    const replay = response();
    await tokenHandler(
      request("POST", installationId, {
        body: {
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: originalRefreshToken,
          resource: mcpResource(baseUrl, installationId),
        },
      }),
      replay.response,
    );
    expect(replay.body().error).toBe("invalid_grant");

    const revoke = response();
    await revokeHandler(
      request("POST", installationId, {
        body: { token: refresh.body().access_token, client_id: clientId },
      }),
      revoke.response,
    );
    expect(revoke.status()).toBe(200);
    await expect(
      authenticateMcpRequest(`Bearer ${refresh.body().access_token}`, {
        baseUrl,
        installationId,
      }),
    ).rejects.toThrow("Invalid or expired");
  });
});
