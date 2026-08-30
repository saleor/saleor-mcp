import { readFileSync } from "node:fs";

import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";

import {
  authorizeMcpCapability,
  authorizeRootFields,
  McpScopeAuthorizationError,
} from "./authorize";
import { assertMutationAllowed, assertQueryAllowed } from "./policy";
import { ROOT_FIELD_SCOPES } from "./root-field-scopes";
import {
  DEFAULT_MCP_SCOPES,
  grantableMcpScopesForSaleorPermissions,
  intersectMcpScopes,
  MCP_SCOPE_CATALOG,
  MCP_SCOPE_VALUES,
  normalizeMcpScopes,
  parseMcpScopeParameter,
  SALEOR_PERMISSION_VALUES,
  type McpScope,
} from "./scopes";

const unrestricted = {
  enabledScopes: new Set<McpScope>(),
  defaultScopes: new Set<McpScope>(),
  mode: "unrestricted" as const,
  allowedMutations: new Set<string>(),
};

function granted(...scopes: McpScope[]) {
  return new Set(scopes);
}

describe("MCP scope catalog", () => {
  it("has one complete, serializable definition per scope", () => {
    expect(MCP_SCOPE_CATALOG.map(({ id }) => id)).toEqual(MCP_SCOPE_VALUES);
    expect(new Set(MCP_SCOPE_VALUES).size).toBe(MCP_SCOPE_VALUES.length);
    expect(MCP_SCOPE_CATALOG.every(({ description }) => description.length > 0)).toBe(true);
    expect(DEFAULT_MCP_SCOPES).toContain("saleor:connection:read");
    expect(DEFAULT_MCP_SCOPES).toContain("saleor:schema:read");
    expect(MCP_SCOPE_CATALOG.filter(({ risk }) => risk === "high").length).toBeGreaterThan(0);
  });

  it("normalizes token scopes without allowing unknown values", () => {
    expect(
      normalizeMcpScopes(["saleor:orders:read", "future:unknown", "saleor:orders:read"]),
    ).toEqual({
      scopes: new Set(["saleor:orders:read"]),
      unknownScopes: ["future:unknown"],
    });
    expect(parseMcpScopeParameter("saleor:schema:read saleor:catalog:read")).toEqual([
      "saleor:schema:read",
      "saleor:catalog:read",
    ]);
    expect(() => parseMcpScopeParameter("saleor:catalog:read future:unknown")).toThrow(
      "Unknown MCP scope",
    );
  });

  it("intersects installation and requested scope ceilings", () => {
    expect(
      intersectMcpScopes(
        ["saleor:catalog:read", "saleor:orders:read", "unknown"],
        ["saleor:orders:read", "saleor:payments:read"],
      ),
    ).toEqual(["saleor:orders:read"]);
  });
});

describe("Saleor Dashboard permission ceiling", () => {
  it("grants permission-free staff reads but narrows protected domains", () => {
    expect(
      grantableMcpScopesForSaleorPermissions(
        [
          "saleor:connection:read",
          "saleor:schema:read",
          "saleor:taxes:read",
          "saleor:catalog:read",
          "saleor:orders:read",
          "saleor:payments:read",
          "unknown",
        ],
        ["MANAGE_PRODUCTS", "MANAGE_ORDERS"],
      ),
    ).toEqual([
      "saleor:connection:read",
      "saleor:schema:read",
      "saleor:catalog:read",
      "saleor:orders:read",
      "saleor:taxes:read",
    ]);
  });

  it("does not let an order manager acquire payment transaction authority", () => {
    expect(
      grantableMcpScopesForSaleorPermissions(
        ["saleor:payments:read", "saleor:payments:write"],
        ["MANAGE_ORDERS"],
      ),
    ).toEqual([]);
    expect(
      grantableMcpScopesForSaleorPermissions(
        ["saleor:payments:read", "saleor:payments:write"],
        ["MANAGE_ORDERS", "HANDLE_PAYMENTS"],
      ),
    ).toEqual(["saleor:payments:read", "saleor:payments:write"]);
  });

  it("reserves cross-domain system scopes for users holding the full ceiling", () => {
    expect(
      grantableMcpScopesForSaleorPermissions(["saleor:system:write"], ["MANAGE_SETTINGS"]),
    ).toEqual([]);
    expect(
      grantableMcpScopesForSaleorPermissions(
        ["saleor:system:read", "saleor:system:write"],
        SALEOR_PERMISSION_VALUES,
      ),
    ).toEqual(["saleor:system:read", "saleor:system:write"]);
  });
});

describe("bundled Saleor schema scope coverage", () => {
  const schema = buildSchema(readFileSync("schema.graphql", "utf8"));

  it("classifies every bundled query root field exactly once", () => {
    const schemaFields = Object.keys(schema.getQueryType()!.getFields()).sort();
    const mappedFields = Object.keys(ROOT_FIELD_SCOPES.query)
      .filter((field) => !field.startsWith("__"))
      .sort();
    expect(mappedFields).toEqual(schemaFields);
  });

  it("classifies every bundled mutation root field exactly once", () => {
    expect(Object.keys(ROOT_FIELD_SCOPES.mutation).sort()).toEqual(
      Object.keys(schema.getMutationType()!.getFields()).sort(),
    );
  });

  it("only refers to catalogued scopes", () => {
    const valid = new Set<string>(MCP_SCOPE_VALUES);
    for (const fields of Object.values(ROOT_FIELD_SCOPES)) {
      for (const scopes of Object.values(fields)) {
        expect(scopes.every((scope) => valid.has(scope))).toBe(true);
      }
    }
  });
});

describe("GraphQL root scope enforcement", () => {
  it("uses underlying field names for aliases and root fragments", () => {
    const analysis = assertQueryAllowed(`
      query Catalog {
        aliasedProducts: products(first: 1) { edges { node { id } } }
        ...OrderRoots
        ... on Query { shop { name } }
      }
      fragment OrderRoots on Query { recentOrders: orders(first: 1) { edges { node { id } } } }
    `);
    expect(analysis.queryFields).toEqual(["products", "orders", "shop"]);
    expect(() =>
      authorizeRootFields(
        analysis,
        granted("saleor:catalog:read", "saleor:orders:read", "saleor:settings:read"),
      ),
    ).not.toThrow();
  });

  it("enforces only the operation selected for upstream execution", () => {
    const document = `
      query ReadCatalog { products(first: 1) { edges { node { id } } } }
      mutation DeleteStaff { staffDelete(id: "1") { errors { field } } }
    `;
    const read = assertQueryAllowed(document, "ReadCatalog");
    expect(read.operationCount).toBe(2);
    expect(read.queryFields).toEqual(["products"]);
    expect(() => authorizeRootFields(read, granted("saleor:catalog:read"))).not.toThrow();

    const write = assertMutationAllowed(document, unrestricted, "DeleteStaff");
    expect(write.mutationFields).toEqual(["staffDelete"]);
    expect(() => authorizeRootFields(write, granted("saleor:staff:write"))).not.toThrow();
    expect(() => assertQueryAllowed(document)).toThrow("operation_name");
    expect(() => assertQueryAllowed(document, "Missing")).toThrow("does not exist");
  });

  it("reports every missing scope with an OAuth challenge", () => {
    const analysis = assertMutationAllowed(
      `mutation Refund { orderRefund(id: "1", amount: 10) { errors { field } } }`,
      unrestricted,
    );
    let failure: McpScopeAuthorizationError | undefined;
    try {
      authorizeRootFields(analysis, granted("saleor:orders:write"));
    } catch (error) {
      failure = error as McpScopeAuthorizationError;
    }
    expect(failure).toBeInstanceOf(McpScopeAuthorizationError);
    expect(failure?.toJSON()).toMatchObject({
      code: "MCP_SCOPE_DENIED",
      operation: "mutation",
      operationName: "Refund",
      missingScopes: ["saleor:payments:write"],
      wwwAuthenticate: 'Bearer error="insufficient_scope", scope="saleor:payments:write"',
    });
  });

  it("fails closed for root fields absent from the reviewed schema map", () => {
    const analysis = assertQueryAllowed("query Future { newlyAddedRootField }");
    expect(() => authorizeRootFields(analysis, granted(...MCP_SCOPE_VALUES))).toThrow(
      "unclassified root field(s): newlyAddedRootField",
    );
  });

  it("protects MCP-native schema and connection capabilities", () => {
    expect(() =>
      authorizeMcpCapability("connection_info", ["saleor:connection:read"], granted()),
    ).toThrowError(McpScopeAuthorizationError);
    expect(() =>
      authorizeMcpCapability(
        "introspect_schema",
        ["saleor:schema:read"],
        granted("saleor:schema:read"),
      ),
    ).not.toThrow();
  });
});
