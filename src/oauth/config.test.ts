import type { NextApiRequest } from "next";
import { describe, expect, it } from "vitest";

import { canonicalUrl, getPublicBaseUrl } from "./config";

describe("OAuth public URL configuration", () => {
  it("requires a configured canonical origin in production", () => {
    const request = {
      headers: { host: "attacker-controlled.example", "x-forwarded-proto": "https" },
    } as unknown as NextApiRequest;
    expect(() => getPublicBaseUrl(request, { NODE_ENV: "production" })).toThrow(
      "APP_API_BASE_URL is required in production",
    );
    expect(
      getPublicBaseUrl(request, {
        NODE_ENV: "production",
        APP_API_BASE_URL: "https://MCP.Example.com/",
      }),
    ).toBe("https://mcp.example.com");
  });

  it("accepts only HTTPS origins or loopback HTTP", () => {
    expect(canonicalUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(() => canonicalUrl("http://shop.example.com")).toThrow("must use HTTPS");
    expect(() => canonicalUrl("https://shop.example.com/path")).toThrow("must not contain a path");
    expect(() => canonicalUrl("https://user:password@shop.example.com")).toThrow(
      "must not contain credentials",
    );
  });
});
