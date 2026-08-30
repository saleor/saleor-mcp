import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PolicyConfig } from "./config";
import { createMcpServer } from "./server";
import type { McpScope } from "./scopes";

const authData = {
  appId: "app",
  saleorApiUrl: "https://shop.saleor.cloud/graphql/",
  token: "app-token",
};

function policy(
  mode: PolicyConfig["mode"] = "read_only",
  allowedMutations: string[] = [],
): PolicyConfig {
  return {
    enabledScopes: new Set(),
    defaultScopes: new Set(),
    mode,
    allowedMutations: new Set(allowedMutations),
  };
}

async function connectedClient(
  scopes: readonly McpScope[] = [],
  installationPolicy: PolicyConfig = policy(),
) {
  const server = createMcpServer(
    authData,
    { scopes },
    {
      policyLoader: async () => installationPolicy,
    },
  );
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe("Saleor MCP contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("exposes the four v2 tools, schema resource, and prompt", async () => {
    const { client, server } = await connectedClient(["saleor:catalog:read"]);
    await expect(client.listTools()).resolves.toMatchObject({
      tools: expect.arrayContaining([
        expect.objectContaining({ name: "connection_info" }),
        expect.objectContaining({ name: "introspect_schema" }),
        expect.objectContaining({ name: "run_query" }),
        expect.objectContaining({ name: "run_mutation" }),
      ]),
    });
    await expect(client.listResources()).resolves.toMatchObject({
      resources: [expect.objectContaining({ uri: "saleor://schema/graphql" })],
    });
    await expect(client.listPrompts()).resolves.toMatchObject({
      prompts: [expect.objectContaining({ name: "explore_saleor" })],
    });
    await client.close();
    await server.close();
  });

  it("returns the raw GraphQL data and errors as structured content", async () => {
    const body = { data: { products: { edges: [] } }, errors: [{ message: "partial" }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    );
    const { client, server } = await connectedClient(["saleor:catalog:read"]);
    const response = await client.callTool({
      name: "run_query",
      arguments: { query: "query { products(first: 1) { edges { node { id } } } }" },
    });
    expect(response.structuredContent).toEqual(body);
    await client.close();
    await server.close();
  });

  it("keeps mutations read-only by default", async () => {
    const { client, server } = await connectedClient(["saleor:catalog:write"]);
    const response = await client.callTool({
      name: "run_mutation",
      arguments: {
        query: 'mutation { productCreate(input: {name: "x"}) { product { id } errors { field } } }',
      },
    });
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response.content)).toContain("read-only mode");
    await client.close();
    await server.close();
  });

  it("fails closed in read_write until a mutation is explicitly allowlisted", async () => {
    const { client, server } = await connectedClient(
      ["saleor:catalog:write"],
      policy("read_write"),
    );
    const response = await client.callTool({
      name: "run_mutation",
      arguments: {
        query: 'mutation { productCreate(input: {name: "x"}) { product { id } } }',
      },
    });
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response.content)).toContain("not in this installation's allowlist");
    await client.close();
    await server.close();
  });

  it("reports that writes are disabled when the read_write allowlist is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              app: { name: "Saleor MCP", permissions: [] },
              shop: { name: "Test shop", version: "3.21" },
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const { client, server } = await connectedClient(
      ["saleor:connection:read", "saleor:catalog:write"],
      policy("read_write"),
    );
    const response = await client.callTool({ name: "connection_info" });
    expect(response.structuredContent).toMatchObject({
      mode: "read_write",
      writesEnabled: false,
      allowedMutations: [],
    });
    await client.close();
    await server.close();
  });

  it("runs an explicitly allowlisted mutation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { productCreate: { product: { id: "1" } } } }), {
          status: 200,
        }),
      ),
    );
    const { client, server } = await connectedClient(
      ["saleor:catalog:write"],
      policy("read_write", ["productCreate"]),
    );
    const response = await client.callTool({
      name: "run_mutation",
      arguments: {
        query: 'mutation { productCreate(input: {name: "x"}) { product { id } } }',
      },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toEqual({
      data: { productCreate: { product: { id: "1" } } },
    });
    await client.close();
    await server.close();
  });

  it("returns structured scope denial details before calling Saleor", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { client, server } = await connectedClient(["saleor:orders:read"]);
    const response = await client.callTool({
      name: "run_query",
      arguments: { query: "query Catalog { aliased: products(first: 1) { totalCount } }" },
    });
    expect(response.isError).toBe(true);
    expect(response.structuredContent).toMatchObject({
      error: {
        code: "MCP_SCOPE_DENIED",
        operation: "query",
        operationName: "Catalog",
        missingScopes: ["saleor:catalog:read"],
        wwwAuthenticate: 'Bearer error="insufficient_scope", scope="saleor:catalog:read"',
      },
    });
    expect(fetch).not.toHaveBeenCalled();
    await client.close();
    await server.close();
  });
});
