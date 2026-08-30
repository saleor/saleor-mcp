import type { AuthData } from "@saleor/app-sdk/APL";
import type { NextApiRequest, NextApiResponse } from "next";
import { describe, expect, it, vi } from "vitest";

const { createProtectedHandler } = vi.hoisted(() => ({
  createProtectedHandler: vi.fn(() => vi.fn()),
}));

vi.mock("@saleor/app-sdk/handlers/next", () => ({ createProtectedHandler }));
vi.mock("@/saleor-app", () => ({ saleorApp: { apl: {} } }));

import { handleSettingsRequest } from "@/pages/api/settings";

const authData: AuthData = {
  appId: "QXBwOjE=",
  saleorApiUrl: "https://shop.saleor.cloud/graphql/",
  token: "app-token",
};

const scopeFields = {
  enabledScopes: ["saleor:schema:read", "saleor:catalog:write"] as const,
  defaultScopes: ["saleor:schema:read"] as const,
};

function policyScopeSets() {
  return {
    enabledScopes: new Set(scopeFields.enabledScopes),
    defaultScopes: new Set(scopeFields.defaultScopes),
  };
}

function createResponse() {
  const result: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  };
  const response = {
    status(status: number) {
      result.status = status;
      return response;
    },
    json(body: unknown) {
      result.body = body;
      return response;
    },
    setHeader(name: string, value: string) {
      result.headers[name] = value;
      return response;
    },
  } as unknown as NextApiResponse;
  return { response, result };
}

function request(method: string, body?: unknown): NextApiRequest {
  return { method, body } as NextApiRequest;
}

describe("permission settings API", () => {
  it("protects the endpoint with MANAGE_APPS", () => {
    expect(createProtectedHandler).toHaveBeenCalledWith(expect.any(Function), expect.anything(), [
      "MANAGE_APPS",
    ]);
  });

  it("returns the metadata-backed policy", async () => {
    const load = vi.fn().mockResolvedValue({
      source: "private_metadata",
      policy: { ...policyScopeSets(), mode: "read_only", allowedMutations: new Set() },
    });
    const { response, result } = createResponse();

    await handleSettingsRequest(request("GET"), response, authData, {
      load,
      save: vi.fn(),
    });

    expect(result).toMatchObject({
      status: 200,
      body: {
        source: "private_metadata",
        policy: {
          version: 1,
          ...scopeFields,
          mode: "read_only",
          allowedMutations: [],
        },
      },
    });
  });

  it("validates PUT bodies before saving", async () => {
    const save = vi.fn();
    const { response, result } = createResponse();

    await handleSettingsRequest(
      request("PUT", {
        ...scopeFields,
        mode: "read_write",
        allowedMutations: ["not-a-field"],
      }),
      response,
      authData,
      { load: vi.fn(), save },
    );

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: expect.stringContaining("GraphQL field names") });
    expect(save).not.toHaveBeenCalled();
  });

  it("saves a normalized policy", async () => {
    const save = vi.fn().mockResolvedValue({
      version: 1,
      ...scopeFields,
      mode: "read_write",
      allowedMutations: ["productCreate"],
    });
    const { response, result } = createResponse();

    await handleSettingsRequest(
      request("PUT", {
        ...scopeFields,
        mode: "read_write",
        allowedMutations: ["productCreate", "productCreate"],
      }),
      response,
      authData,
      { load: vi.fn(), save },
    );

    expect(save).toHaveBeenCalledWith(authData, {
      ...policyScopeSets(),
      mode: "read_write",
      allowedMutations: new Set(["productCreate"]),
    });
    expect(result).toMatchObject({ status: 200, body: { source: "private_metadata" } });
  });

  it("returns a useful method contract", async () => {
    const { response, result } = createResponse();

    await handleSettingsRequest(request("POST"), response, authData, {
      load: vi.fn(),
      save: vi.fn(),
    });

    expect(result).toMatchObject({
      status: 405,
      headers: { Allow: "GET, PUT" },
      body: { error: "Method not allowed" },
    });
  });
});
