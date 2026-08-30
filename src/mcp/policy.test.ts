import { OperationTypeNode } from "graphql";
import { describe, expect, it } from "vitest";

import type { PolicyConfig } from "./config";
import { analyzeDocument, assertMutationAllowed, assertQueryAllowed } from "./policy";

const query = "query { products(first: 1) { edges { node { id } } } }";
const mutation =
  'mutation { productCreate(input: {name: "x"}) { product { id } errors { field } } }';
const dangerous = 'mutation { staffDelete(id: "1") { errors { field } } }';

function policy(mode: PolicyConfig["mode"], allowed: string[] = []): PolicyConfig {
  return {
    enabledScopes: new Set(),
    defaultScopes: new Set(),
    mode,
    allowedMutations: new Set(allowed),
  };
}

describe("GraphQL policy", () => {
  it("classifies query and mutation root fields", () => {
    const read = analyzeDocument(query);
    expect(read.operationTypes.has(OperationTypeNode.QUERY)).toBe(true);
    expect(read.queryFields).toEqual(["products"]);
    expect(analyzeDocument(mutation).mutationFields).toEqual(["productCreate"]);
  });

  it("resolves inline fragments and fragment spreads", () => {
    expect(
      analyzeDocument("mutation { ... on Mutation { staffCreate(input: {}) { user { id } } } }")
        .mutationFields,
    ).toEqual(["staffCreate"]);
    expect(
      analyzeDocument(
        "mutation { ...M } fragment M on Mutation { staffCreate(input: {}) { user { id } } }",
      ).mutationFields,
    ).toEqual(["staffCreate"]);
  });

  it("rejects invalid and non-executable documents", () => {
    expect(() => analyzeDocument("query { products(")).toThrow("Invalid GraphQL syntax");
    expect(() => analyzeDocument("fragment F on Product { id }")).toThrow(
      "no executable operation",
    );
  });

  it("keeps reads and writes separate", () => {
    expect(() => assertQueryAllowed(mutation)).toThrow("run_mutation");
    expect(() => assertMutationAllowed(query, policy("read_write"))).toThrow("not a mutation");
    expect(() => assertQueryAllowed("subscription { event { issuedAt } }")).toThrow(
      "Subscriptions",
    );
  });

  it("enforces read_only and a fail-closed read_write allowlist", () => {
    expect(() => assertMutationAllowed(mutation, policy("read_only"))).toThrow("read-only mode");
    expect(() => assertMutationAllowed(mutation, policy("read_write"))).toThrow(
      "not in this installation's allowlist",
    );
    expect(
      assertMutationAllowed(mutation, policy("read_write", ["productCreate"])).mutationFields,
    ).toEqual(["productCreate"]);
    expect(assertMutationAllowed(dangerous, policy("unrestricted")).mutationFields).toEqual([
      "staffDelete",
    ]);
  });

  it("rejects every root mutation unless all are allowlisted", () => {
    const several =
      'mutation { productCreate(input: {name: "x"}) { product { id } } productDelete(id: "1") { product { id } } }';
    expect(() => assertMutationAllowed(several, policy("read_write", ["productCreate"]))).toThrow(
      "productDelete",
    );
    expect(
      assertMutationAllowed(several, policy("read_write", ["productCreate", "productDelete"]))
        .mutationFields,
    ).toEqual(["productCreate", "productDelete"]);
  });
});
