import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAllowedSaleorUrls, createRegisterHandler } from "./register";

function registrationRequest(saleorApiUrl: string): NextApiRequest {
  return {
    method: "POST",
    headers: { "saleor-api-url": saleorApiUrl },
    body: { auth_token: "untrusted-token" },
  } as unknown as NextApiRequest;
}

function registrationResponse() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status: vi.fn((status: number) => {
      statusCode = status;
      return response;
    }),
    json: vi.fn((value: unknown) => {
      body = value;
      return response;
    }),
    send: vi.fn((value: unknown) => {
      body = value;
      return response;
    }),
  } as unknown as NextApiResponse;
  return { response, statusCode: () => statusCode, body: () => body };
}

describe("registration domain filter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects every installation when no pattern is configured", () => {
    const [isAllowed] = createAllowedSaleorUrls(undefined);
    expect(isAllowed("https://demo.saleor.cloud/graphql/")).toBe(false);
  });

  it("requires the configured pattern to match the complete Saleor API URL", () => {
    const [isAllowed] = createAllowedSaleorUrls("https://[a-z0-9-]+\\.saleor\\.cloud/graphql/");
    expect(isAllowed("https://demo.saleor.cloud/graphql/")).toBe(true);
    expect(isAllowed("https://demo.saleor.cloud/graphql/extra")).toBe(false);
  });

  it("fails early for an invalid regular expression", () => {
    expect(() => createAllowedSaleorUrls("[")).toThrow();
  });

  it("rejects an unapproved URL before making an outbound request", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const target = registrationResponse();

    await createRegisterHandler(undefined)(
      registrationRequest("http://169.254.169.254/latest/meta-data"),
      target.response,
    );

    expect(target.statusCode()).toBe(403);
    expect(target.body()).toMatchObject({ error: { code: "SALEOR_URL_PROHIBITED" } });
    expect(fetch).not.toHaveBeenCalled();
  });
});
