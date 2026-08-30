import {
  DEFAULT_MCP_SCOPES,
  grantableMcpScopesForSaleorPermissions,
  MCP_SCOPE_VALUES,
  parseMcpScopeParameter,
} from "@/mcp/scopes";

/** Complete authorization-server scope catalogue, including step-up scopes. */
export function getSupportedOAuthScopes(): string[] {
  return [...MCP_SCOPE_VALUES];
}

/** Least-privilege initial set advertised in the MCP bearer challenge. */
export function getDefaultOAuthScopes(): string[] {
  return [...DEFAULT_MCP_SCOPES];
}

export function parseRequestedScopes(value: string | undefined): string[] {
  return parseMcpScopeParameter(value ?? DEFAULT_MCP_SCOPES.join(" "));
}

export function grantableOAuthScopes(
  requestedScopes: Iterable<string>,
  saleorPermissions: Iterable<string>,
): string[] {
  return grantableMcpScopesForSaleorPermissions(requestedScopes, saleorPermissions);
}
