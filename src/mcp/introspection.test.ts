import { buildSchema, getIntrospectionQuery, graphqlSync } from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSchemaCachesForTests,
  describeOperation,
  describeType,
  getSchema,
  listOperations,
  searchSchema,
} from "./introspection";

const authData = {
  appId: "app",
  saleorApiUrl: "https://shop.saleor.cloud/graphql/",
  token: "token",
};

describe("schema discovery", () => {
  beforeEach(clearSchemaCachesForTests);
  afterEach(() => vi.unstubAllGlobals());

  it("caches successful live introspection by Saleor API URL", async () => {
    const schema = buildSchema("type Query { shop: Shop! } type Shop { name: String! }");
    const introspection = graphqlSync({
      schema,
      source: getIntrospectionQuery({ descriptions: true }),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: introspection.data }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const first = await getSchema(authData);
    const second = await getSchema(authData);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the bundled v2 schema without pinning it to the installation", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const schema = await getSchema(authData);
    expect(schema.getType("Warehouse")).toBeDefined();
    await getSchema(authData);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("searches and describes types and operations", () => {
    const schema = buildSchema(`
      type Query { warehouses(first: Int): [Warehouse!]! }
      type Mutation { warehouseCreate(input: WarehouseInput!): Warehouse }
      type Warehouse { id: ID!, name: String! }
      input WarehouseInput { name: String! }
    `);
    expect(searchSchema(schema, "warehouse").types).toContainEqual({
      name: "Warehouse",
      kind: "OBJECT",
    });
    expect(listOperations(schema, "query").operations[0].name).toBe("warehouses");
    expect(describeOperation(schema, "warehouseCreate")).toMatchObject({ kind: "mutation" });
    expect(describeType(schema, "WarehouseInput")).toMatchObject({ kind: "INPUT_OBJECT" });
  });
});
