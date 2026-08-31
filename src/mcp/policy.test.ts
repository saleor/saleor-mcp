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

  it("visits each named fragment only once", () => {
    const fragments: string[] = [];
    for (let index = 0; index < 16; index += 1) {
      fragments.push(`fragment F${index} on Mutation { ...F${index + 1} ...F${index + 1} }`);
    }
    fragments.push("fragment F16 on Mutation { productCreate(input: {}) { __typename } }");

    expect(analyzeDocument(`mutation { ...F0 } ${fragments.join(" ")}`).mutationFields).toEqual([
      "productCreate",
    ]);
  });

  it("handles cyclic fragments without repeated traversal", () => {
    const document = `
      mutation { ...First }
      fragment First on Mutation { productCreate(input: {}) { __typename } ...Second }
      fragment Second on Mutation { ...First }
    `;
    expect(analyzeDocument(document).mutationFields).toEqual(["productCreate"]);
  });

  it("rejects excessive root selection depth and field counts", () => {
    const fragments = Array.from(
      { length: 66 },
      (_, index) => `fragment F${index} on Mutation { ...F${index + 1} }`,
    );
    fragments.push("fragment F66 on Mutation { productCreate(input: {}) { __typename } }");
    expect(() => analyzeDocument(`mutation { ...F0 } ${fragments.join(" ")}`)).toThrow(
      "maximum root selection depth",
    );

    const fields = Array.from(
      { length: 501 },
      (_, index) => `mutation${index}: productCreate(input: {}) { __typename }`,
    );
    expect(() => analyzeDocument(`mutation { ${fields.join(" ")} }`)).toThrow(
      "more than 500 root fields",
    );
  });

  it("rejects unknown, duplicate, and oversized document structures", () => {
    expect(() => analyzeDocument("mutation { ...Missing }")).toThrow(
      "Unknown GraphQL fragment 'Missing'",
    );
    expect(() =>
      analyzeDocument(`
        mutation { ...Payload }
        fragment Payload on Mutation { productCreate(input: {}) { __typename } }
        fragment Payload on Mutation { staffDelete(id: "1") { __typename } }
      `),
    ).toThrow("Duplicate GraphQL fragment 'Payload'");
    expect(() => analyzeDocument(`${" ".repeat(100_001)}query { __typename }`)).toThrow(
      "maximum size of 100000 characters",
    );
  });

  it("rejects invalid and non-executable documents", () => {
    expect(() => analyzeDocument("query { products(")).toThrow("Invalid GraphQL syntax");
    expect(() => analyzeDocument("fragment F on Product { id }")).toThrow(
      "no executable operation",
    );
  });

  it("keeps reads and writes separate", () => {
    expect(() => assertQueryAllowed(mutation)).toThrow("run_mutation");
    expect(() => assertMutationAllowed(query, policy("read_write"))).toThrow("no mutation");
    expect(() => assertQueryAllowed("subscription { event { issuedAt } }")).toThrow(
      "Subscriptions",
    );
  });

  it("enforces read_only and a fail-closed read_write allowlist", () => {
    expect(() => assertMutationAllowed(mutation, policy("read_only"))).toThrow("read_only mode");
    expect(() => assertMutationAllowed(mutation, policy("read_write"))).toThrow(
      "not in the deployment allowlist",
    );
    expect(
      assertMutationAllowed(mutation, policy("read_write", ["productCreate"])).mutationFields,
    ).toEqual(["productCreate"]);
    expect(() => assertMutationAllowed(dangerous, policy("read_write"))).toThrow("staffDelete");
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
