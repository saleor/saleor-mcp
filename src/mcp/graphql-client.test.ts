import { afterEach, describe, expect, it, vi } from "vitest";

import { executeGraphql, SaleorGraphQLError } from "./graphql-client";

const authData = {
  appId: "app",
  saleorApiUrl: "https://shop.saleor.cloud/graphql/",
  token: "app-token",
};

describe("executeGraphql", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the server-side app token and preserves data plus errors", async () => {
    const body = { data: { product: null }, errors: [{ message: "partial" }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(executeGraphql(authData, 'query { product(id: "x") { id } }')).resolves.toEqual(
      body,
    );
    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers["Authorization-Bearer"]).toBe("app-token");
  });

  it("turns HTTP and invalid JSON failures into transport errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 502 })));
    await expect(executeGraphql(authData, "query { shop { name } }")).rejects.toBeInstanceOf(
      SaleorGraphQLError,
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    await expect(executeGraphql(authData, "query { shop { name } }")).rejects.toThrow("non-JSON");
  });
});
