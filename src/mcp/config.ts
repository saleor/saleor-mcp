import { z } from "zod";

import { DEFAULT_MCP_SCOPES, MCP_SCOPE_VALUES, type McpScope } from "./scopes";

export const POLICY_METADATA_KEY = "saleor.mcp.installation-policy.v1";

export const policyModes = ["read_only", "read_write", "unrestricted"] as const;

export type Mode = (typeof policyModes)[number];

export type PolicyConfig = {
  enabledScopes: Set<McpScope>;
  defaultScopes: Set<McpScope>;
  mode: Mode;
  allowedMutations: Set<string>;
};

export type SerializedPolicyConfig = {
  version: 1;
  enabledScopes: McpScope[];
  defaultScopes: McpScope[];
  mode: Mode;
  allowedMutations: string[];
};

const graphqlName = /^[_A-Za-z][_0-9A-Za-z]*$/;

const policyInputSchema = z
  .object({
    version: z.literal(1).optional(),
    enabledScopes: z.array(z.enum(MCP_SCOPE_VALUES)).max(MCP_SCOPE_VALUES.length),
    defaultScopes: z.array(z.enum(MCP_SCOPE_VALUES)).max(MCP_SCOPE_VALUES.length),
    mode: z.enum(policyModes),
    allowedMutations: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Mutation names cannot be empty.")
          .max(255, "Mutation names must be at most 255 characters.")
          .regex(graphqlName, "Mutation names must be valid GraphQL field names."),
      )
      .max(500, "At most 500 mutations can be allowlisted."),
  })
  .strict()
  .superRefine((policy, context) => {
    const enabled = new Set(policy.enabledScopes);
    policy.defaultScopes.forEach((scope, index) => {
      if (!enabled.has(scope)) {
        context.addIssue({
          code: "custom",
          path: ["defaultScopes", index],
          message: "A default scope must also be enabled for this installation.",
        });
      }
    });
  });

export class PolicyConfigValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PolicyConfigValidationError";
  }
}

export function defaultPolicyConfig(): PolicyConfig {
  return {
    enabledScopes: new Set(DEFAULT_MCP_SCOPES),
    defaultScopes: new Set(DEFAULT_MCP_SCOPES),
    mode: "read_only",
    allowedMutations: new Set(),
  };
}

export function serializePolicyConfig(policy: PolicyConfig): SerializedPolicyConfig {
  return {
    version: 1,
    enabledScopes: MCP_SCOPE_VALUES.filter((scope) => policy.enabledScopes.has(scope)),
    defaultScopes: MCP_SCOPE_VALUES.filter((scope) => policy.defaultScopes.has(scope)),
    mode: policy.mode,
    allowedMutations: [...policy.allowedMutations].sort(),
  };
}

export function parsePolicyConfigInput(value: unknown): PolicyConfig {
  const result = policyInputSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const location = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new PolicyConfigValidationError(
      `Invalid permission configuration. ${location}${issue?.message ?? "Invalid value."}`,
      { cause: result.error },
    );
  }

  return {
    enabledScopes: new Set(result.data.enabledScopes),
    defaultScopes: new Set(result.data.defaultScopes),
    mode: result.data.mode,
    allowedMutations: new Set(result.data.allowedMutations),
  };
}

export function parsePolicyMetadata(value: string): PolicyConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new PolicyConfigValidationError("The saved permission configuration is not valid JSON.", {
      cause: error,
    });
  }

  return parsePolicyConfigInput(parsed);
}

export function stringifyPolicyMetadata(policy: PolicyConfig): string {
  return JSON.stringify(serializePolicyConfig(policy));
}
