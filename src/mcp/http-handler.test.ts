import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saleorApp } from "@/saleor-app";
import { stubCredentialKeys } from "@/tests/credential-keys";

import handler from "./http-handler";
import { issueInstallationCredential } from "./installation-credential";

function request(method: string, authorization?: string): NextApiRequest {
  return { method, headers: { authorization } } as NextApiRequest;
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
  } as unknown as NextApiResponse;
  return { res, statusCode: () => statusCode, body: () => body };
}

describe("MCP HTTP route", () => {
  beforeEach(stubCredentialKeys);

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("allows only POST requests", async () => {
    const target = response();
    await handler(request("GET"), target.res);
    expect(target.statusCode()).toBe(405);
    expect(target.res.setHeader).toHaveBeenCalledWith("Allow", "POST");
  });

  it("returns 401 for a missing or invalid installation credential", async () => {
    const missing = response();
    await handler(request("POST"), missing.res);
    expect(missing.statusCode()).toBe(401);
    expect(missing.body()).toMatchObject({ error: { code: -32001 } });

    const invalid = response();
    await handler(request("POST", "Bearer not-a-jwt"), invalid.res);
    expect(invalid.statusCode()).toBe(401);
    expect(invalid.body()).toMatchObject({
      error: { message: "Invalid MCP installation credential." },
    });
  });

  it("tells the client how to replace an expired installation credential", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-token",
    };
    const credential = await issueInstallationCredential(authData);
    vi.advanceTimersByTime(90 * 24 * 60 * 60 * 1_000 + 1_000);

    const target = response();
    await handler(request("POST", `Bearer ${credential}`), target.res);

    expect(target.statusCode()).toBe(401);
    expect(target.body()).toMatchObject({
      error: {
        message:
          "MCP installation credential expired. Open the Saleor MCP app in Dashboard and copy a new configuration.",
      },
    });
  });

  it("returns 500 when installation storage is unavailable", async () => {
    const authData = {
      appId: "app-1",
      saleorApiUrl: "https://shop.saleor.cloud/graphql/",
      token: "server-token",
    };
    const credential = await issueInstallationCredential(authData);
    vi.spyOn(saleorApp.apl, "get").mockRejectedValue(new Error("DynamoDB unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const target = response();
    await handler(request("POST", `Bearer ${credential}`), target.res);

    expect(target.statusCode()).toBe(500);
    expect(target.body()).toMatchObject({
      error: { code: -32603, message: "Internal server error" },
    });
  });

  it("returns 500 when the server credential public key is misconfigured", async () => {
    vi.stubEnv("MCP_CREDENTIAL_PUBLIC_KEY", "not-a-public-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const target = response();
    await handler(request("POST", "Bearer credential"), target.res);

    expect(target.statusCode()).toBe(500);
    expect(target.body()).toMatchObject({
      error: { code: -32603, message: "Internal server error" },
    });
  });
});
