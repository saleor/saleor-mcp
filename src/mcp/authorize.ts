import { OperationTypeNode } from "graphql";

import type { DocumentAnalysis } from "./policy";
import { requiredScopesForRootField, type RootOperationKind } from "./root-field-scopes";
import { normalizeMcpScopes, type McpScope, type NormalizedMcpScopes } from "./scopes";

export type McpAuthorization = {
  scopes: Iterable<string>;
};

export type McpScopeDenial = {
  field: string;
  requiredScopes: readonly McpScope[];
  missingScopes: readonly McpScope[];
  reason: "insufficient_scope" | "unclassified_field";
};

export class McpScopeAuthorizationError extends Error {
  readonly code = "MCP_SCOPE_DENIED";
  readonly operation: RootOperationKind | "capability";
  readonly operationName?: string;
  readonly denials: readonly McpScopeDenial[];
  readonly grantedScopes: readonly McpScope[];
  readonly requiredScopes: readonly McpScope[];
  readonly missingScopes: readonly McpScope[];
  readonly wwwAuthenticate?: string;

  constructor(options: {
    operation: RootOperationKind | "capability";
    operationName?: string;
    denials: readonly McpScopeDenial[];
    grantedScopes: ReadonlySet<McpScope>;
  }) {
    const requiredScopes = [
      ...new Set(options.denials.flatMap(({ requiredScopes }) => requiredScopes)),
    ].sort();
    const missingScopes = [
      ...new Set(options.denials.flatMap(({ missingScopes }) => missingScopes)),
    ].sort();
    const unclassified = options.denials
      .filter(({ reason }) => reason === "unclassified_field")
      .map(({ field }) => field)
      .sort();
    const insufficient = options.denials
      .filter(({ reason }) => reason === "insufficient_scope")
      .map(({ field, missingScopes: missing }) => `${field} (${missing.join(" + ")})`)
      .sort();
    const details = [
      unclassified.length > 0
        ? `unclassified root field(s): ${unclassified.join(", ")}; new fields fail closed until reviewed`
        : undefined,
      insufficient.length > 0 ? `missing scope(s): ${insufficient.join(", ")}` : undefined,
    ].filter(Boolean);
    super(`MCP authorization denied: ${details.join("; ")}.`);
    this.name = "McpScopeAuthorizationError";
    this.operation = options.operation;
    this.operationName = options.operationName;
    this.denials = options.denials;
    this.grantedScopes = [...options.grantedScopes].sort();
    this.requiredScopes = requiredScopes;
    this.missingScopes = missingScopes;
    if (missingScopes.length > 0) {
      this.wwwAuthenticate = `Bearer error="insufficient_scope", scope="${missingScopes.join(" ")}"`;
    }
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      operation: this.operation,
      operationName: this.operationName,
      denials: this.denials,
      grantedScopes: this.grantedScopes,
      requiredScopes: this.requiredScopes,
      missingScopes: this.missingScopes,
      ...(this.wwwAuthenticate ? { wwwAuthenticate: this.wwwAuthenticate } : {}),
    };
  }
}

export function prepareMcpAuthorization(authorization: McpAuthorization): NormalizedMcpScopes {
  return normalizeMcpScopes(authorization.scopes);
}

export function authorizeMcpCapability(
  capability: string,
  requiredScopes: readonly McpScope[],
  grantedScopes: ReadonlySet<McpScope>,
): void {
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
  if (missingScopes.length === 0) return;
  throw new McpScopeAuthorizationError({
    operation: "capability",
    operationName: capability,
    grantedScopes,
    denials: [
      {
        field: capability,
        requiredScopes,
        missingScopes,
        reason: "insufficient_scope",
      },
    ],
  });
}

export function authorizeRootFields(
  analysis: DocumentAnalysis,
  grantedScopes: ReadonlySet<McpScope>,
): void {
  const operation: RootOperationKind =
    analysis.selectedOperationType === OperationTypeNode.MUTATION ? "mutation" : "query";
  const fields = operation === "mutation" ? analysis.mutationFields : analysis.queryFields;
  const denials: McpScopeDenial[] = [];

  for (const field of new Set(fields)) {
    const requiredScopes = requiredScopesForRootField(operation, field);
    if (!requiredScopes) {
      denials.push({
        field,
        requiredScopes: [],
        missingScopes: [],
        reason: "unclassified_field",
      });
      continue;
    }
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
    if (missingScopes.length > 0) {
      denials.push({
        field,
        requiredScopes,
        missingScopes,
        reason: "insufficient_scope",
      });
    }
  }

  if (denials.length > 0) {
    throw new McpScopeAuthorizationError({
      operation,
      operationName: analysis.operationName,
      denials,
      grantedScopes,
    });
  }
}

export function mcpScopeErrorResult(error: McpScopeAuthorizationError) {
  const structuredContent = { error: error.toJSON() };
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}
