import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthData } from "@saleor/app-sdk/APL";
import { printSchema } from "graphql";
import { z } from "zod";

import packageJson from "../../package.json";

import {
  authorizeMcpCapability,
  authorizeRootFields,
  McpScopeAuthorizationError,
  mcpScopeErrorResult,
  prepareMcpAuthorization,
  type McpAuthorization,
} from "./authorize";
import { loadPolicyConfig } from "./config-repository";
import type { PolicyConfig } from "./config";
import { executeGraphql, SaleorGraphQLError } from "./graphql-client";
import {
  describeOperation,
  describeType,
  getSchema,
  listOperations,
  searchSchema,
} from "./introspection";
import { assertMutationAllowed, assertQueryAllowed } from "./policy";
import { MCP_SCOPE_CATALOG } from "./scopes";

const CONNECTION_QUERY = `
query SaleorMcpConnectionInfo {
  me { email isStaff userPermissions { code } }
  app { name permissions { code } }
  shop { name version }
}`;

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export type McpServerOptions = {
  policyLoader?: (authData: AuthData) => Promise<PolicyConfig>;
};

export function createMcpServer(
  authData: AuthData,
  authorization: McpAuthorization = { scopes: [] },
  options: McpServerOptions = {},
): McpServer {
  const server = new McpServer({ name: "Saleor MCP Server", version: packageJson.version });
  const normalizedAuthorization = prepareMcpAuthorization(authorization);
  const grantedScopes = normalizedAuthorization.scopes;
  const policyLoader = options.policyLoader ?? loadPolicyConfig;

  server.registerTool(
    "run_query",
    {
      title: "Run GraphQL query",
      description:
        "Execute a read-only GraphQL query against the connected Saleor instance. Every root field requires its domain read scope. Returns the raw GraphQL response, preserving data and errors.",
      inputSchema: {
        query: z.string().describe("A GraphQL query document. Must contain only query operations."),
        variables: z
          .record(z.string(), z.unknown())
          .nullable()
          .optional()
          .describe("Variables for the query, as a JSON object."),
        operation_name: z
          .string()
          .nullable()
          .optional()
          .describe("Operation name to run when the document defines several."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, variables, operation_name }) => {
      try {
        const analysis = assertQueryAllowed(query, operation_name);
        authorizeRootFields(analysis, grantedScopes);
        return result(await executeGraphql(authData, query, variables, operation_name));
      } catch (error) {
        if (error instanceof McpScopeAuthorizationError) return mcpScopeErrorResult(error);
        throw error;
      }
    },
  );

  server.registerTool(
    "run_mutation",
    {
      title: "Run GraphQL mutation",
      description:
        "Execute a GraphQL mutation against the connected Saleor instance, subject to user write scopes and the installation safety policy. Returns the raw GraphQL response, preserving data and errors.",
      inputSchema: {
        query: z
          .string()
          .describe("A GraphQL mutation document. Must contain only mutation operations."),
        variables: z
          .record(z.string(), z.unknown())
          .nullable()
          .optional()
          .describe("Variables for the mutation, as a JSON object."),
        operation_name: z
          .string()
          .nullable()
          .optional()
          .describe("Operation name to run when the document defines several."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async ({ query, variables, operation_name }) => {
      try {
        const analysis = assertMutationAllowed(query, await policyLoader(authData), operation_name);
        authorizeRootFields(analysis, grantedScopes);
        return result(await executeGraphql(authData, query, variables, operation_name));
      } catch (error) {
        if (error instanceof McpScopeAuthorizationError) return mcpScopeErrorResult(error);
        throw error;
      }
    },
  );

  server.registerTool(
    "introspect_schema",
    {
      title: "Introspect schema",
      description:
        "Explore the Saleor GraphQL schema in small slices using search, describe_type, list_operations, or describe_operation.",
      inputSchema: {
        action: z.enum(["search", "describe_type", "list_operations", "describe_operation"]),
        name: z.string().nullable().optional(),
        kind: z.enum(["query", "mutation"]).nullable().optional(),
        search: z.string().nullable().optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ action, name, kind, search }) => {
      try {
        authorizeMcpCapability("introspect_schema", ["saleor:schema:read"], grantedScopes);
      } catch (error) {
        if (error instanceof McpScopeAuthorizationError) return mcpScopeErrorResult(error);
        throw error;
      }
      const schema = await getSchema(authData);
      if (action === "search") {
        return result(
          search
            ? searchSchema(schema, search)
            : { error: "The 'search' action requires the 'search' argument." },
        );
      }
      if (action === "list_operations") {
        return result(
          kind
            ? listOperations(schema, kind, search)
            : {
                error:
                  "The 'list_operations' action requires the 'kind' argument ('query' or 'mutation').",
              },
        );
      }
      if (action === "describe_type") {
        return result(
          name
            ? describeType(schema, name)
            : { error: "The 'describe_type' action requires the 'name' argument." },
        );
      }
      return result(
        name
          ? describeOperation(schema, name, kind)
          : { error: "The 'describe_operation' action requires the 'name' argument." },
      );
    },
  );

  server.registerTool(
    "connection_info",
    {
      title: "Connection info",
      description:
        "Report the connected instance, app-token permissions, granted MCP user scopes, and active installation safety policy. Requires saleor:connection:read. Call this first.",
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        authorizeMcpCapability("connection_info", ["saleor:connection:read"], grantedScopes);
      } catch (error) {
        if (error instanceof McpScopeAuthorizationError) return mcpScopeErrorResult(error);
        throw error;
      }
      const policy = await policyLoader(authData);
      const grantedScopeDefinitions = MCP_SCOPE_CATALOG.filter(({ id }) => grantedScopes.has(id));
      const hasWriteScope = grantedScopeDefinitions.some(({ access }) => access === "write");
      const identity: Record<string, unknown> = {};
      try {
        const response = await executeGraphql(authData, CONNECTION_QUERY);
        const data = (response.data ?? {}) as Record<string, Record<string, unknown> | null>;
        if (data.me) {
          identity.user = {
            email: data.me.email,
            isStaff: data.me.isStaff,
            permissions: ((data.me.userPermissions as Array<{ code: string }> | null) ?? []).map(
              ({ code }) => code,
            ),
          };
        }
        if (data.app) {
          identity.app = {
            name: data.app.name,
            permissions: ((data.app.permissions as Array<{ code: string }> | null) ?? []).map(
              ({ code }) => code,
            ),
          };
        }
        if (data.shop) identity.shop = data.shop;
      } catch (error) {
        if (!(error instanceof SaleorGraphQLError)) throw error;
        identity.warning = `Could not read identity/permissions: ${error.message}`;
      }

      return result({
        apiUrl: authData.saleorApiUrl,
        mode: policy.mode,
        writesEnabled:
          hasWriteScope &&
          (policy.mode === "unrestricted" ||
            (policy.mode === "read_write" && policy.allowedMutations.size > 0)),
        allowedMutations: policy.mode === "read_write" ? [...policy.allowedMutations].sort() : [],
        mcpAuthorization: {
          grantedScopes: [...grantedScopes].sort(),
          unknownScopes: normalizedAuthorization.unknownScopes,
          capabilities: grantedScopeDefinitions,
        },
        ...identity,
      });
    },
  );

  server.registerResource(
    "Saleor GraphQL schema (SDL)",
    "saleor://schema/graphql",
    {
      mimeType: "text/plain",
      description: "The connected Saleor instance's GraphQL schema as SDL.",
    },
    async () => {
      authorizeMcpCapability("saleor://schema/graphql", ["saleor:schema:read"], grantedScopes);
      return {
        contents: [
          {
            uri: "saleor://schema/graphql",
            mimeType: "text/plain",
            text: printSchema(await getSchema(authData)),
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "explore_saleor",
    { description: "Guidance for exploring and operating a Saleor instance through this server." },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "You are connected to a Saleor Commerce instance through a generic GraphQL gateway. Work in this loop:\n1. Call 'connection_info' to see the instance, the app-token ceiling, your granted MCP scopes, and whether writes are enabled.\n2. Use 'introspect_schema' to discover what's available: 'search' by keyword, 'list_operations' for queries/mutations, then 'describe_operation' and 'describe_type' to learn exact arguments and fields.\n3. Run reads with 'run_query' and writes with 'run_mutation'. Always request only the fields you need.\nRemember: every selected GraphQL root field requires its domain-specific MCP scope, the Dashboard user's permissions limit which scopes may be granted, the installed app's Saleor permissions remain the upstream ceiling, and mutations are additionally subject to the installation safety policy. Read structured authorization and GraphQL errors to self-correct.",
          },
        },
      ],
    }),
  );

  return server;
}
