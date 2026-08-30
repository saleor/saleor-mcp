# MCP user scopes

MCP user scopes narrow an individual OAuth grant below two other authorization
ceilings:

1. The consenting Dashboard user's own Saleor permissions determine which MCP
   scopes may be minted.
2. Installation settings determine which scopes the app administrator has enabled.
3. The installed app token's Saleor permissions remain the final upstream ceiling.

All three checks are required. The MCP server executes GraphQL with the app token, so
minting a scope without first intersecting the Dashboard user's permissions would be
a privilege escalation.

## Scope model

Scopes use `saleor:<domain>:<access>`. Read and write access are independent; a write
scope does not imply its matching read scope. The domains cover catalog, inventory,
attributes, orders, checkouts, payments, customers, identity, staff, discounts, gift
cards, content, navigation, shipping, taxes, translations, channels, apps, webhooks,
settings, plugins, exports, files, and high-risk cross-domain system operations.

Payments, gift cards, customer identity, staff, apps, webhooks, settings, plugins,
and system operations are marked high risk or sensitive in the scope catalog. The
catalog also contains MCP-native `saleor:connection:read` and
`saleor:schema:read` scopes. `DEFAULT_MCP_SCOPES` is a read-only starting set; it is
still narrowed by installation settings and the user's Saleor permissions.

The canonical, serializable catalog is exported from `src/mcp/scopes.ts`:

- `MCP_SCOPE_VALUES`: every valid scope ID in stable display order.
- `MCP_SCOPE_CATALOG`: labels, descriptions, domain groups, read/write access,
  risk level, and required Dashboard permission codes.
- `DEFAULT_MCP_SCOPES`: the recommended read-only defaults.
- `parseMcpScopeParameter`: strict OAuth scope parsing.
- `intersectMcpScopes`: installation-ceiling intersection.
- `grantableMcpScopesForSaleorPermissions`: Dashboard-user ceiling intersection.

Consent code should narrow in this order (set intersection is commutative, but this
order makes audit logs easier to understand):

```ts
const enabled = intersectMcpScopes(requestedScopes, installation.enabledScopes);
const granted = grantableMcpScopesForSaleorPermissions(
  enabled,
  dashboardUser.userPermissions.map(({ code }) => code),
);
```

The Dashboard JWT must only be used to verify the consenting user and read those
permission codes. MCP access tokens contain the already-narrowed MCP scope IDs and
are separate from the Dashboard JWT and the app token.

## GraphQL enforcement

`src/mcp/root-field-scopes.ts` contains an exact mapping for every root query and
mutation in the bundled `schema.graphql`. Tests compare both root types to the
schema, so a bundled schema upgrade cannot silently leave a field unreviewed. At
runtime, an unknown field has no prefix or category fallback and fails closed before
any request reaches Saleor.

Aliases are resolved to their underlying field names. Root inline fragments and
fragment spreads are traversed. For documents containing multiple operations,
`operation_name` is mandatory and only that selected operation is authorized, which
matches Saleor's execution semantics. Every root field in an operation must pass.

Some operations intentionally require multiple scopes. For example, refunding an
order requires both `saleor:orders:write` and `saleor:payments:write`, checkout
payment creation requires checkout and payment write scopes, and creating an export
requires the export write scope plus the appropriate data-domain read scope.

GraphQL federation `_entities` and generic metadata mutations cross normal domain
boundaries. They require `saleor:system:read` or `saleor:system:write`, whose consent
ceiling requires the full set of Saleor Dashboard permissions. They are not default
scopes.

## Denials and discovery

Scope denial happens before upstream execution and returns structured MCP error
content. It includes the selected operation, affected root fields, required and
missing scopes, granted scopes, and an OAuth-compatible `WWW-Authenticate` challenge
value when reauthorization can resolve the denial:

```json
{
  "error": {
    "code": "MCP_SCOPE_DENIED",
    "operation": "query",
    "operationName": "Catalog",
    "missingScopes": ["saleor:catalog:read"],
    "wwwAuthenticate": "Bearer error=\"insufficient_scope\", scope=\"saleor:catalog:read\""
  }
}
```

`connection_info` requires `saleor:connection:read` and reports the granted known
scopes, any ignored unknown token scopes, their catalog metadata, app-token
permissions, and the installation write policy. `introspect_schema`, the schema
resource, and GraphQL introspection roots require `saleor:schema:read`.

Unknown scopes in an access token never grant authority. OAuth authorization
requests should use the strict parser and return an OAuth `invalid_scope` response
when they contain unknown scope IDs.
