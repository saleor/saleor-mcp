import { describe, expect, it, vi } from "vitest";

import {
  loadPolicyConfigState,
  PolicyConfigPersistenceError,
  savePolicyConfig,
} from "./config-repository";
import { defaultPolicyConfig, POLICY_METADATA_KEY } from "./config";

const authData = {
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

describe("Saleor app private metadata policy repository", () => {
  it("loads a saved policy from the currently authenticated app", async () => {
    const execute = vi.fn().mockResolvedValue({
      data: {
        app: {
          id: authData.appId,
          privateMetafield: JSON.stringify({
            version: 1,
            ...scopeFields,
            mode: "read_write",
            allowedMutations: ["productUpdate", "productCreate"],
          }),
        },
      },
    });

    const state = await loadPolicyConfigState(authData, execute);

    expect(state).toEqual({
      source: "private_metadata",
      policy: {
        ...policyScopeSets(),
        mode: "read_write",
        allowedMutations: new Set(["productUpdate", "productCreate"]),
      },
    });
    expect(execute).toHaveBeenCalledWith(authData, expect.stringContaining("privateMetafield"), {
      key: POLICY_METADATA_KEY,
    });
  });

  it("uses safe defaults when the metadata has never been saved", async () => {
    const execute = vi.fn().mockResolvedValue({
      data: { app: { id: authData.appId, privateMetafield: null } },
    });

    await expect(loadPolicyConfigState(authData, execute)).resolves.toEqual({
      source: "default",
      policy: defaultPolicyConfig(),
    });
  });

  it("fails closed and reports a warning when saved metadata is invalid", async () => {
    const execute = vi.fn().mockResolvedValue({
      data: { app: { id: authData.appId, privateMetafield: "invalid" } },
    });

    const state = await loadPolicyConfigState(authData, execute);

    expect(state.source).toBe("invalid_private_metadata");
    expect(state.policy).toEqual(defaultPolicyConfig());
    expect(state.warning).toContain("Safe read-only defaults");
  });

  it("saves versioned policy JSON to the installed app's private metadata", async () => {
    const metadataValue = JSON.stringify({
      version: 1,
      ...scopeFields,
      mode: "read_write",
      allowedMutations: ["productCreate"],
    });
    const execute = vi.fn().mockResolvedValue({
      data: {
        updatePrivateMetadata: {
          errors: [],
          item: { privateMetafield: metadataValue },
        },
      },
    });

    await expect(
      savePolicyConfig(
        authData,
        {
          ...policyScopeSets(),
          mode: "read_write",
          allowedMutations: new Set(["productCreate"]),
        },
        execute,
      ),
    ).resolves.toEqual({
      version: 1,
      ...scopeFields,
      mode: "read_write",
      allowedMutations: ["productCreate"],
    });
    expect(execute).toHaveBeenCalledWith(
      authData,
      expect.stringContaining("updatePrivateMetadata"),
      {
        appId: authData.appId,
        key: POLICY_METADATA_KEY,
        input: [{ key: POLICY_METADATA_KEY, value: metadataValue }],
      },
    );
  });

  it("surfaces Saleor metadata mutation errors", async () => {
    const execute = vi.fn().mockResolvedValue({
      data: {
        updatePrivateMetadata: {
          errors: [{ code: "NOT_UPDATED", message: "No metadata access" }],
          item: null,
        },
      },
    });

    await expect(savePolicyConfig(authData, defaultPolicyConfig(), execute)).rejects.toThrow(
      PolicyConfigPersistenceError,
    );
  });

  it("surfaces top-level GraphQL errors instead of silently defaulting", async () => {
    const execute = vi.fn().mockResolvedValue({ errors: [{ message: "Token is invalid" }] });

    await expect(loadPolicyConfigState(authData, execute)).rejects.toThrow("Token is invalid");
  });

  it("does not accept settings returned for a different app", async () => {
    const execute = vi.fn().mockResolvedValue({
      data: { app: { id: "QXBwOjk5", privateMetafield: null } },
    });

    await expect(loadPolicyConfigState(authData, execute)).rejects.toThrow("different app");
  });
});
