/**
 * MCP scopes are an authorization layer below the installed Saleor app's permissions.
 * The app token remains the hard upstream ceiling; these scopes narrow what an
 * individual OAuth grant may ask the app token to do.
 */

export const MCP_SCOPE_VALUES = [
  "saleor:connection:read",
  "saleor:schema:read",
  "saleor:catalog:read",
  "saleor:catalog:write",
  "saleor:inventory:read",
  "saleor:inventory:write",
  "saleor:attributes:read",
  "saleor:attributes:write",
  "saleor:orders:read",
  "saleor:orders:write",
  "saleor:order-imports:write",
  "saleor:checkouts:read",
  "saleor:checkouts:write",
  "saleor:payments:read",
  "saleor:payments:write",
  "saleor:customers:read",
  "saleor:customers:write",
  "saleor:identity:read",
  "saleor:identity:write",
  "saleor:staff:read",
  "saleor:staff:write",
  "saleor:discounts:read",
  "saleor:discounts:write",
  "saleor:gift-cards:read",
  "saleor:gift-cards:write",
  "saleor:content:read",
  "saleor:content:write",
  "saleor:navigation:read",
  "saleor:navigation:write",
  "saleor:shipping:read",
  "saleor:shipping:write",
  "saleor:taxes:read",
  "saleor:taxes:write",
  "saleor:translations:read",
  "saleor:translations:write",
  "saleor:channels:read",
  "saleor:channels:write",
  "saleor:apps:read",
  "saleor:apps:write",
  "saleor:webhooks:read",
  "saleor:webhooks:write",
  "saleor:settings:read",
  "saleor:settings:write",
  "saleor:plugins:read",
  "saleor:plugins:write",
  "saleor:exports:read",
  "saleor:exports:write",
  "saleor:files:write",
  "saleor:system:read",
  "saleor:system:write",
] as const;

export type McpScope = (typeof MCP_SCOPE_VALUES)[number];
export type McpScopeAccess = "read" | "write";
export type McpScopeRisk = "standard" | "sensitive" | "high";

export const SALEOR_PERMISSION_VALUES = [
  "MANAGE_USERS",
  "MANAGE_STAFF",
  "IMPERSONATE_USER",
  "MANAGE_APPS",
  "MANAGE_OBSERVABILITY",
  "MANAGE_CHECKOUTS",
  "HANDLE_CHECKOUTS",
  "HANDLE_TAXES",
  "MANAGE_TAXES",
  "MANAGE_CHANNELS",
  "MANAGE_DISCOUNTS",
  "MANAGE_GIFT_CARD",
  "MANAGE_MENUS",
  "MANAGE_ORDERS",
  "MANAGE_ORDERS_IMPORT",
  "MANAGE_PAGES",
  "MANAGE_PAGE_TYPES_AND_ATTRIBUTES",
  "HANDLE_PAYMENTS",
  "MANAGE_PLUGINS",
  "MANAGE_PRODUCTS",
  "MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES",
  "MANAGE_SHIPPING",
  "MANAGE_SETTINGS",
  "MANAGE_TRANSLATIONS",
] as const;

export type SaleorPermissionCode = (typeof SALEOR_PERMISSION_VALUES)[number];

export type McpScopeDefinition = {
  id: McpScope;
  group: string;
  title: string;
  description: string;
  access: McpScopeAccess;
  risk: McpScopeRisk;
  /** Every listed Saleor permission must be held by the consenting Dashboard user. */
  requiredSaleorPermissions: readonly SaleorPermissionCode[];
};

const ALL_SALEOR_PERMISSIONS: readonly SaleorPermissionCode[] = SALEOR_PERMISSION_VALUES;

const permissions = {
  catalog: ["MANAGE_PRODUCTS"] as const,
  attributes: ["MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES", "MANAGE_PAGE_TYPES_AND_ATTRIBUTES"] as const,
  orders: ["MANAGE_ORDERS"] as const,
  checkoutsRead: ["MANAGE_CHECKOUTS"] as const,
  checkoutsWrite: ["HANDLE_CHECKOUTS"] as const,
  payments: ["MANAGE_ORDERS", "HANDLE_PAYMENTS"] as const,
  content: ["MANAGE_PAGES", "MANAGE_PAGE_TYPES_AND_ATTRIBUTES"] as const,
  channelsWrite: ["MANAGE_CHANNELS"] as const,
};

const definitions: Record<McpScope, Omit<McpScopeDefinition, "id">> = {
  "saleor:connection:read": {
    group: "connection",
    title: "View connection details",
    description: "View the connected Saleor instance, identity, app permissions, and MCP policy.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: [],
  },
  "saleor:schema:read": {
    group: "schema",
    title: "Explore the API schema",
    description: "Search, describe, and read the connected Saleor GraphQL schema.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: [],
  },
  "saleor:catalog:read": {
    group: "catalog",
    title: "View catalog",
    description: "View products, variants, categories, collections, and digital content.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: permissions.catalog,
  },
  "saleor:catalog:write": {
    group: "catalog",
    title: "Manage catalog",
    description: "Create, update, publish, and delete catalog objects.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: permissions.catalog,
  },
  "saleor:inventory:read": {
    group: "inventory",
    title: "View inventory",
    description: "View warehouses and stock levels.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: permissions.catalog,
  },
  "saleor:inventory:write": {
    group: "inventory",
    title: "Manage inventory",
    description: "Manage warehouses, warehouse assignments, and stock levels.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: permissions.catalog,
  },
  "saleor:attributes:read": {
    group: "attributes",
    title: "View attributes",
    description: "View product types, page types, attributes, and attribute values.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: permissions.attributes,
  },
  "saleor:attributes:write": {
    group: "attributes",
    title: "Manage attributes",
    description: "Manage product and page types, attributes, and attribute values.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: permissions.attributes,
  },
  "saleor:orders:read": {
    group: "orders",
    title: "View orders",
    description: "View orders, draft orders, invoices, and order settings.",
    access: "read",
    risk: "sensitive",
    requiredSaleorPermissions: permissions.orders,
  },
  "saleor:orders:write": {
    group: "orders",
    title: "Manage orders",
    description: "Manage orders, draft orders, fulfillment, invoices, and notes.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: permissions.orders,
  },
  "saleor:order-imports:write": {
    group: "orders",
    title: "Import orders",
    description: "Bulk import orders into Saleor.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_ORDERS_IMPORT"],
  },
  "saleor:checkouts:read": {
    group: "checkouts",
    title: "View checkouts",
    description: "View checkouts and checkout lines.",
    access: "read",
    risk: "sensitive",
    requiredSaleorPermissions: permissions.checkoutsRead,
  },
  "saleor:checkouts:write": {
    group: "checkouts",
    title: "Manage checkouts",
    description: "Create and update checkouts, their lines, addresses, and delivery methods.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: permissions.checkoutsWrite,
  },
  "saleor:payments:read": {
    group: "payments",
    title: "View payments",
    description: "View payment and transaction records.",
    access: "read",
    risk: "high",
    requiredSaleorPermissions: permissions.payments,
  },
  "saleor:payments:write": {
    group: "payments",
    title: "Manage payments",
    description: "Capture, refund, void, initialize, and process payments and transactions.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: permissions.payments,
  },
  "saleor:customers:read": {
    group: "customers",
    title: "View customers",
    description: "View customers, their addresses, and personally identifiable information.",
    access: "read",
    risk: "sensitive",
    requiredSaleorPermissions: ["MANAGE_USERS"],
  },
  "saleor:customers:write": {
    group: "customers",
    title: "Manage customers",
    description: "Create, update, activate, and delete customer accounts and addresses.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_USERS"],
  },
  "saleor:identity:read": {
    group: "identity",
    title: "View identity",
    description: "View the current identity and address validation rules.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: [],
  },
  "saleor:identity:write": {
    group: "identity",
    title: "Manage identity",
    description: "Run account, password, email, external-authentication, and token operations.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["IMPERSONATE_USER"],
  },
  "saleor:staff:read": {
    group: "staff",
    title: "View staff",
    description: "View staff users and permission groups.",
    access: "read",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_STAFF"],
  },
  "saleor:staff:write": {
    group: "staff",
    title: "Manage staff",
    description: "Create, update, delete, and assign permissions to staff users.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_STAFF"],
  },
  "saleor:discounts:read": {
    group: "discounts",
    title: "View discounts",
    description: "View promotions, sales, and vouchers.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: ["MANAGE_DISCOUNTS"],
  },
  "saleor:discounts:write": {
    group: "discounts",
    title: "Manage discounts",
    description: "Manage promotions, sales, vouchers, and voucher codes.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: ["MANAGE_DISCOUNTS"],
  },
  "saleor:gift-cards:read": {
    group: "gift-cards",
    title: "View gift cards",
    description: "View gift cards, balances, tags, currencies, and settings.",
    access: "read",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_GIFT_CARD"],
  },
  "saleor:gift-cards:write": {
    group: "gift-cards",
    title: "Manage gift cards",
    description: "Create, update, activate, deactivate, resend, and delete gift cards.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_GIFT_CARD"],
  },
  "saleor:content:read": {
    group: "content",
    title: "View pages",
    description: "View pages, page types, and page attributes.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: permissions.content,
  },
  "saleor:content:write": {
    group: "content",
    title: "Manage pages",
    description: "Manage pages, page types, publication, and page attributes.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: permissions.content,
  },
  "saleor:navigation:read": {
    group: "navigation",
    title: "View navigation",
    description: "View menus and menu items.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: ["MANAGE_MENUS"],
  },
  "saleor:navigation:write": {
    group: "navigation",
    title: "Manage navigation",
    description: "Manage menus, menu items, and navigation assignments.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: ["MANAGE_MENUS"],
  },
  "saleor:shipping:read": {
    group: "shipping",
    title: "View shipping",
    description: "View shipping zones, methods, and prices.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: ["MANAGE_SHIPPING"],
  },
  "saleor:shipping:write": {
    group: "shipping",
    title: "Manage shipping",
    description: "Manage shipping zones, methods, prices, and exclusions.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: ["MANAGE_SHIPPING"],
  },
  "saleor:taxes:read": {
    group: "taxes",
    title: "View taxes",
    description: "View tax classes, rates, configurations, and tax types.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: [],
  },
  "saleor:taxes:write": {
    group: "taxes",
    title: "Manage taxes",
    description: "Manage tax classes, rates, exemptions, and configurations.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: ["MANAGE_TAXES"],
  },
  "saleor:translations:read": {
    group: "translations",
    title: "View translations",
    description: "View translatable resources and existing translations.",
    access: "read",
    risk: "standard",
    requiredSaleorPermissions: ["MANAGE_TRANSLATIONS"],
  },
  "saleor:translations:write": {
    group: "translations",
    title: "Manage translations",
    description: "Create and update translations across commerce resources.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: ["MANAGE_TRANSLATIONS"],
  },
  "saleor:channels:read": {
    group: "channels",
    title: "View channels",
    description: "View channels and their commerce settings.",
    access: "read",
    risk: "sensitive",
    requiredSaleorPermissions: [],
  },
  "saleor:channels:write": {
    group: "channels",
    title: "Manage channels",
    description: "Manage channels, activation, warehouses, and channel-level settings.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: permissions.channelsWrite,
  },
  "saleor:apps:read": {
    group: "apps",
    title: "View apps",
    description: "View installed apps, installations, extensions, and app tokens.",
    access: "read",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_APPS"],
  },
  "saleor:apps:write": {
    group: "apps",
    title: "Manage apps",
    description: "Install, configure, activate, deactivate, and delete apps and app tokens.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_APPS"],
  },
  "saleor:webhooks:read": {
    group: "webhooks",
    title: "View webhooks",
    description: "View webhook subscriptions, event types, payload samples, and deliveries.",
    access: "read",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_APPS", "MANAGE_OBSERVABILITY"],
  },
  "saleor:webhooks:write": {
    group: "webhooks",
    title: "Manage webhooks",
    description: "Manage, test, trigger, and retry webhook subscriptions and deliveries.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_APPS", "MANAGE_OBSERVABILITY"],
  },
  "saleor:settings:read": {
    group: "settings",
    title: "View instance settings",
    description: "View shop and instance-wide settings.",
    access: "read",
    risk: "sensitive",
    requiredSaleorPermissions: [],
  },
  "saleor:settings:write": {
    group: "settings",
    title: "Manage instance settings",
    description: "Manage shop identity, address, notifications, and instance-wide settings.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_SETTINGS"],
  },
  "saleor:plugins:read": {
    group: "plugins",
    title: "View plugins",
    description: "View Saleor plugin configuration.",
    access: "read",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_PLUGINS"],
  },
  "saleor:plugins:write": {
    group: "plugins",
    title: "Manage plugins",
    description: "Update Saleor plugin configuration.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ["MANAGE_PLUGINS"],
  },
  "saleor:exports:read": {
    group: "exports",
    title: "View exports",
    description: "View export jobs and download URLs.",
    access: "read",
    risk: "sensitive",
    requiredSaleorPermissions: ["MANAGE_PRODUCTS"],
  },
  "saleor:exports:write": {
    group: "exports",
    title: "Create exports",
    description: "Create exports; the corresponding data-domain read scope is also required.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: [],
  },
  "saleor:files:write": {
    group: "files",
    title: "Upload files",
    description: "Upload a file to Saleor for later use.",
    access: "write",
    risk: "sensitive",
    requiredSaleorPermissions: [],
  },
  "saleor:system:read": {
    group: "system",
    title: "Read arbitrary federated entities",
    description: "Use GraphQL federation entity lookups, which can cross commerce domains.",
    access: "read",
    risk: "high",
    requiredSaleorPermissions: ALL_SALEOR_PERMISSIONS,
  },
  "saleor:system:write": {
    group: "system",
    title: "Write arbitrary metadata",
    description: "Update or delete metadata on objects across commerce domains.",
    access: "write",
    risk: "high",
    requiredSaleorPermissions: ALL_SALEOR_PERMISSIONS,
  },
};

export const MCP_SCOPE_CATALOG: readonly McpScopeDefinition[] = MCP_SCOPE_VALUES.map((id) => ({
  id,
  ...definitions[id],
}));

export const DEFAULT_MCP_SCOPES: readonly McpScope[] = [
  "saleor:connection:read",
  "saleor:schema:read",
  "saleor:catalog:read",
  "saleor:inventory:read",
  "saleor:attributes:read",
  "saleor:orders:read",
  "saleor:checkouts:read",
  "saleor:customers:read",
  "saleor:discounts:read",
  "saleor:content:read",
  "saleor:navigation:read",
  "saleor:shipping:read",
  "saleor:taxes:read",
  "saleor:translations:read",
  "saleor:channels:read",
];

const scopeSet: ReadonlySet<string> = new Set(MCP_SCOPE_VALUES);

export function isMcpScope(value: string): value is McpScope {
  return scopeSet.has(value);
}

export type NormalizedMcpScopes = {
  scopes: ReadonlySet<McpScope>;
  unknownScopes: readonly string[];
};

export function normalizeMcpScopes(values: Iterable<string>): NormalizedMcpScopes {
  const scopes = new Set<McpScope>();
  const unknownScopes = new Set<string>();
  for (const value of values) {
    if (isMcpScope(value)) scopes.add(value);
    else unknownScopes.add(value);
  }
  return {
    scopes,
    unknownScopes: [...unknownScopes].sort(),
  };
}

/** Parse an OAuth `scope` parameter and fail closed on unknown values. */
export function parseMcpScopeParameter(value: string): McpScope[] {
  const requested = value.split(/\s+/).filter(Boolean);
  const normalized = normalizeMcpScopes(requested);
  if (normalized.unknownScopes.length > 0) {
    throw new Error(`Unknown MCP scope(s): ${normalized.unknownScopes.join(", ")}`);
  }
  return MCP_SCOPE_VALUES.filter((scope) => normalized.scopes.has(scope));
}

/**
 * Narrow a requested OAuth scope set to what the authenticated Dashboard user's
 * own Saleor permissions can safely authorize through the broader app token.
 * Unknown requested scopes are ignored and therefore never granted.
 */
export function grantableMcpScopesForSaleorPermissions(
  requested: Iterable<string>,
  saleorPermissions: Iterable<string>,
): McpScope[] {
  const requestedScopes = normalizeMcpScopes(requested).scopes;
  const heldPermissions = new Set(saleorPermissions);
  return MCP_SCOPE_CATALOG.filter(
    ({ id, requiredSaleorPermissions }) =>
      requestedScopes.has(id) &&
      requiredSaleorPermissions.every((permission) => heldPermissions.has(permission)),
  ).map(({ id }) => id);
}

export function intersectMcpScopes(
  requested: Iterable<string>,
  enabled: Iterable<string>,
): McpScope[] {
  const requestedScopes = normalizeMcpScopes(requested).scopes;
  const enabledScopes = normalizeMcpScopes(enabled).scopes;
  return MCP_SCOPE_VALUES.filter((scope) => requestedScopes.has(scope) && enabledScopes.has(scope));
}
