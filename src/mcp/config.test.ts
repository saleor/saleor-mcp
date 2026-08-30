import { describe, expect, it } from "vitest";

import {
  defaultPolicyConfig,
  parsePolicyConfigInput,
  parsePolicyMetadata,
  PolicyConfigValidationError,
  serializePolicyConfig,
  stringifyPolicyMetadata,
} from "./config";
import { DEFAULT_MCP_SCOPES } from "./scopes";

const scopeFields = {
  enabledScopes: ["saleor:schema:read", "saleor:catalog:write"] as const,
  defaultScopes: ["saleor:schema:read"] as const,
};

describe("installation policy configuration", () => {
  it("defaults to a fail-closed read-only policy", () => {
    expect(defaultPolicyConfig()).toEqual({
      enabledScopes: new Set(DEFAULT_MCP_SCOPES),
      defaultScopes: new Set(DEFAULT_MCP_SCOPES),
      mode: "read_only",
      allowedMutations: new Set(),
    });
  });

  it("normalizes duplicate mutation names and serializes them deterministically", () => {
    const policy = parsePolicyConfigInput({
      ...scopeFields,
      mode: "read_write",
      allowedMutations: ["productUpdate", "productCreate", "productCreate"],
    });

    expect(serializePolicyConfig(policy)).toEqual({
      version: 1,
      enabledScopes: [...scopeFields.enabledScopes],
      defaultScopes: [...scopeFields.defaultScopes],
      mode: "read_write",
      allowedMutations: ["productCreate", "productUpdate"],
    });
  });

  it("round-trips the versioned private metadata payload", () => {
    const policy = {
      enabledScopes: new Set(scopeFields.enabledScopes),
      defaultScopes: new Set(scopeFields.defaultScopes),
      mode: "unrestricted" as const,
      allowedMutations: new Set(["productUpdate"]),
    };

    expect(parsePolicyMetadata(stringifyPolicyMetadata(policy))).toEqual(policy);
  });

  it("rejects invalid modes, unknown fields, and invalid GraphQL names", () => {
    expect(() =>
      parsePolicyConfigInput({ ...scopeFields, mode: "bogus", allowedMutations: [] }),
    ).toThrow(PolicyConfigValidationError);
    expect(() =>
      parsePolicyConfigInput({
        ...scopeFields,
        mode: "read_only",
        allowedMutations: [],
        extra: true,
      }),
    ).toThrow(PolicyConfigValidationError);
    expect(() =>
      parsePolicyConfigInput({
        ...scopeFields,
        mode: "read_write",
        allowedMutations: ["product-create"],
      }),
    ).toThrow("valid GraphQL field names");
  });

  it("rejects unknown scopes and defaults outside the installation ceiling", () => {
    expect(() =>
      parsePolicyConfigInput({
        enabledScopes: [],
        defaultScopes: ["saleor:unknown:read"],
        mode: "read_only",
        allowedMutations: [],
      }),
    ).toThrow(PolicyConfigValidationError);
    expect(() =>
      parsePolicyConfigInput({
        enabledScopes: ["saleor:schema:read"],
        defaultScopes: ["saleor:catalog:read"],
        mode: "read_only",
        allowedMutations: [],
      }),
    ).toThrow("must also be enabled");
  });

  it("rejects malformed or unsupported metadata", () => {
    expect(() => parsePolicyMetadata("not-json")).toThrow("not valid JSON");
    expect(() =>
      parsePolicyMetadata(
        JSON.stringify({
          ...scopeFields,
          version: 2,
          mode: "read_only",
          allowedMutations: [],
        }),
      ),
    ).toThrow(PolicyConfigValidationError);
  });
});
