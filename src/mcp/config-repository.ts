import type { AuthData } from "@saleor/app-sdk/APL";

import {
  defaultPolicyConfig,
  parsePolicyConfigInput,
  parsePolicyMetadata,
  POLICY_METADATA_KEY,
  PolicyConfigValidationError,
  serializePolicyConfig,
  stringifyPolicyMetadata,
  type PolicyConfig,
  type SerializedPolicyConfig,
} from "./config";
import { executeGraphql, type GraphQLResponse } from "./graphql-client";

const LOAD_POLICY_QUERY = `
  query SaleorMcpInstallationPolicy($key: String!) {
    app {
      id
      privateMetafield(key: $key)
    }
  }
`;

const SAVE_POLICY_MUTATION = `
  mutation SaveSaleorMcpInstallationPolicy($appId: ID!, $input: [MetadataInput!]!, $key: String!) {
    updatePrivateMetadata(id: $appId, input: $input) {
      errors {
        field
        code
        message
      }
      item {
        privateMetafield(key: $key)
      }
    }
  }
`;

type GraphqlExecutor = (
  authData: AuthData,
  query: string,
  variables?: Record<string, unknown> | null,
) => Promise<GraphQLResponse>;

export type PolicyConfigState = {
  policy: PolicyConfig;
  source: "default" | "private_metadata" | "invalid_private_metadata";
  warning?: string;
};

export class PolicyConfigPersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PolicyConfigPersistenceError";
  }
}

function graphqlErrorMessage(response: GraphQLResponse): string | undefined {
  if (!response.errors?.length) return undefined;
  return response.errors
    .map((error) => (typeof error.message === "string" ? error.message : "Unknown GraphQL error"))
    .join("; ");
}

export async function loadPolicyConfigState(
  authData: AuthData,
  execute: GraphqlExecutor = executeGraphql,
): Promise<PolicyConfigState> {
  const response = await execute(authData, LOAD_POLICY_QUERY, { key: POLICY_METADATA_KEY });
  const graphQLError = graphqlErrorMessage(response);
  if (graphQLError) {
    throw new PolicyConfigPersistenceError(
      `Saleor could not load the app permission configuration: ${graphQLError}`,
    );
  }

  const app = (response.data?.app ?? null) as { id?: unknown; privateMetafield?: unknown } | null;
  if (!app || typeof app.id !== "string") {
    throw new PolicyConfigPersistenceError(
      "Saleor did not return the currently authenticated app while loading permissions.",
    );
  }
  if (app.id !== authData.appId) {
    throw new PolicyConfigPersistenceError(
      "Saleor returned a different app while loading this installation's permissions.",
    );
  }

  if (app.privateMetafield == null) {
    return { policy: defaultPolicyConfig(), source: "default" };
  }
  if (typeof app.privateMetafield !== "string") {
    throw new PolicyConfigPersistenceError(
      "Saleor returned an invalid private metadata value for the permission configuration.",
    );
  }

  try {
    return { policy: parsePolicyMetadata(app.privateMetafield), source: "private_metadata" };
  } catch (error) {
    if (!(error instanceof PolicyConfigValidationError)) throw error;
    return {
      policy: defaultPolicyConfig(),
      source: "invalid_private_metadata",
      warning: `${error.message} Safe read-only defaults are active until an administrator saves new settings.`,
    };
  }
}

export async function loadPolicyConfig(
  authData: AuthData,
  execute: GraphqlExecutor = executeGraphql,
): Promise<PolicyConfig> {
  return (await loadPolicyConfigState(authData, execute)).policy;
}

export async function savePolicyConfig(
  authData: AuthData,
  policy: PolicyConfig,
  execute: GraphqlExecutor = executeGraphql,
): Promise<SerializedPolicyConfig> {
  const validatedPolicy = parsePolicyConfigInput(serializePolicyConfig(policy));
  const serialized = serializePolicyConfig(validatedPolicy);
  const metadataValue = stringifyPolicyMetadata(validatedPolicy);
  const response = await execute(authData, SAVE_POLICY_MUTATION, {
    appId: authData.appId,
    key: POLICY_METADATA_KEY,
    input: [{ key: POLICY_METADATA_KEY, value: metadataValue }],
  });
  const graphQLError = graphqlErrorMessage(response);
  if (graphQLError) {
    throw new PolicyConfigPersistenceError(
      `Saleor could not save the app permission configuration: ${graphQLError}`,
    );
  }

  const payload = (response.data?.updatePrivateMetadata ?? null) as {
    errors?: Array<{ field?: unknown; code?: unknown; message?: unknown }>;
    item?: { privateMetafield?: unknown } | null;
  } | null;
  if (!payload) {
    throw new PolicyConfigPersistenceError(
      "Saleor returned no result while saving the app permission configuration.",
    );
  }
  if (payload.errors?.length) {
    throw new PolicyConfigPersistenceError(
      `Saleor rejected the app permission configuration: ${payload.errors
        .map((error) =>
          typeof error.message === "string"
            ? error.message
            : typeof error.code === "string"
              ? error.code
              : "Unknown metadata error",
        )
        .join("; ")}`,
    );
  }
  if (payload.item?.privateMetafield !== metadataValue) {
    throw new PolicyConfigPersistenceError(
      "Saleor did not return the saved app permission configuration.",
    );
  }

  return serialized;
}
