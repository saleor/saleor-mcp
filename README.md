# Saleor MCP Server

A hosted Model Context Protocol (MCP) server for Saleor Commerce, packaged as a
multi-tenant Saleor App. It gives AI assistants four generic tools for discovering and
using a Saleor GraphQL API instead of maintaining a fixed catalogue of actions.

This TypeScript app is a feature-parity migration of the `v2` MCP. The intentional
changes are:

- Saleor installs the app and gives its token directly to the server. Users no longer
  paste Saleor URLs or tokens into an MCP client.
- Each installation gets its own Streamable HTTP URL at `/mcp/<installation-id>`.
  Local stdio is not included.
- The runtime and app boilerplate come from the cleaned Saleor app template on Next.js.

## MCP contract

| Tool                | Purpose                                                               |
| ------------------- | --------------------------------------------------------------------- |
| `connection_info`   | Report installation, app permissions, user scopes, and safety policy. |
| `introspect_schema` | Search and describe schema types, queries, and mutations.             |
| `run_query`         | Run GraphQL queries allowed by the user's domain read scopes.         |
| `run_mutation`      | Run mutations allowed by user scopes and installation policy.         |

The server also exposes the `saleor://schema/graphql` resource and the
`explore_saleor` prompt. GraphQL tool results preserve Saleor's raw `data` and `errors`.

## MCP user authorization scopes

MCP access is split into domain-specific read and write scopes. Catalog, inventory,
orders, checkouts, payments, customers, staff, apps, settings, and the other commerce
domains can be granted independently. High-risk payment, identity, staff, app,
settings, and cross-domain operations are isolated from ordinary reads.

Every GraphQL root field is mapped exactly from the bundled Saleor schema. Unknown
or newly added roots fail closed until reviewed, and every field in a multi-field
operation must be authorized before Saleor is called. The consenting Dashboard
user's Saleor permissions limit which MCP scopes can be granted; the installed app
token's permissions remain the final upstream ceiling.

See [MCP user scopes](docs/mcp-scopes.md) for the scope catalog interface, consent
intersection helper, defaults, GraphQL mapping rules, and structured denial format.

## How authentication works

1. Saleor reads `/api/manifest` and posts the app token to `/api/register` during
   installation.
2. The standard Saleor Auth Persistence Layer (APL) stores the app token. It never
   reaches the browser or MCP client.
3. A Dashboard administrator opens the installed app once. The app records the
   authenticated installation's Dashboard origin and shows its per-instance MCP URL.
4. Codex discovers RFC 9728 protected-resource metadata and RFC 8414 authorization
   server metadata, then dynamically registers a public OAuth client.
5. The OAuth authorization endpoint sends the browser to the preinstalled app's
   `/authorize` view inside that Saleor Dashboard instance.
6. Saleor's signed Dashboard user JWT authenticates the consent request. The app
   intersects the requested MCP scopes with that user's Saleor permissions and issues
   a short-lived, one-time authorization code bound to the exact client, redirect URI,
   MCP resource, and PKCE S256 challenge.
7. The token endpoint consumes the code and mints a separate audience-bound MCP access
   token. The MCP server verifies it, loads the installation's app token from the APL,
   and uses only that server-side app token when calling Saleor.

The Dashboard JWT is never returned to Codex, reused as an MCP bearer token, or passed
through to the Saleor API. Access tokens expire after 15 minutes. Refresh tokens are
opaque, rotate on every use, and cannot extend a grant beyond eight hours without new
Dashboard consent. The RFC 7009 endpoint revokes refresh tokens immediately and
blacklists access tokens for their remaining lifetime.

Uninstalling or reinstalling the app invalidates existing grants because the stored
installation or app ID changes. Rotating `MCP_OAUTH_SECRET` changes installation URLs
and invalidates all tokens for the deployment.

## Install in Saleor

Deploy the app, then use this URL in **Dashboard → Apps → Install external app**:

```text
https://your-deployment.example/api/manifest
```

After installation, open **Saleor MCP** from Apps. A user with `MANAGE_APPS` can copy
the ready-to-use HTTP MCP configuration. For Codex, use the shown URL:

```bash
codex mcp add saleor --url "https://your-deployment.example/mcp/<installation-id>" \
  --oauth-client-registration dcr
```

Codex opens the Saleor Dashboard authorization view automatically. If login was
deferred, run `codex mcp login saleor --oauth-client-registration dcr`. Use
`codex mcp logout saleor` to revoke the saved grant where the client supports OAuth
revocation.

The fixed manifest permission set covers
ordinary catalogue, checkout, order, discount, gift-card, content, shipping, tax,
payment, and translation work. It deliberately excludes staff/customer identity,
app management, plugins, channels, observability, and instance-wide settings.

## Deployment configuration

Copy `.env.example` and configure:

| Variable                  | Purpose                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `APL_PROVIDER`            | `file` for local development or `dynamodb` for production.                             |
| `APL_DYNAMODB_TABLE`      | DynamoDB table used by the APL and OAuth store.                                        |
| `OAUTH_STORE_PROVIDER`    | Optional OAuth override; `memory` for development or `dynamodb` for production.        |
| `AWS_REGION`              | Region for the DynamoDB client. Standard AWS credential discovery is used.             |
| `MCP_OAUTH_SECRET`        | At least 32 random characters used for installation IDs and signing MCP access tokens. |
| `APP_IFRAME_BASE_URL`     | Optional public iframe origin override for local tunnels.                              |
| `APP_API_BASE_URL`        | Canonical public API origin. Required in production for issuer/audience validation.    |
| `SALEOR_DASHBOARD_ORIGIN` | Optional single-instance fallback when the Dashboard parent origin cannot be read.     |
| `ALLOWED_DOMAIN_PATTERN`  | Optional full-match regex limiting Saleor API URLs allowed to install the app.         |

The Saleor SDK DynamoDB APL expects a table with string partition key `PK` and string
sort key `SK`. The app needs `GetItem`, `PutItem`, `DeleteItem`, and `Scan` access to
that table. APL selection is isolated behind `src/lib/apl`, so another persistent
implementation can replace it without changing registration or MCP code.

The OAuth records share the table without storing Saleor or Dashboard bearer tokens;
only app-installation references, public client metadata, short-lived grants, hashed
opaque tokens, and access-token revocations are stored. Configure DynamoDB TTL on the
numeric `expiresAt` attribute to clean up expired OAuth records automatically.

`FileAPL` and the in-memory OAuth store are blocked in production because serverless
filesystems and process memory are not durable.
Vercel needs no custom Next.js build setup; configure the environment variables and
deploy the repository normally.

## Safety policy

The installation write policy is an additional ceiling over user scopes. Unlike the
original `v2` denylist, `read_write` fails closed:

| Mode           | Behavior                                                         |
| -------------- | ---------------------------------------------------------------- |
| `read_only`    | Queries only. This is the default.                               |
| `read_write`   | Only mutations explicitly named in the deployment allowlist run. |
| `unrestricted` | Any mutation allowed by the installed app's permissions can run. |

Set comma-separated `SALEOR_MCP_ALLOWED_MUTATIONS` when using `read_write`. An empty
allowlist permits no mutations, and new Saleor mutations stay disabled until they are
explicitly reviewed and added. `unrestricted` is an explicit escape hatch for trusted
deployments. The installed app's Saleor permissions are always the final ceiling.

## Development

Requirements: Node.js 22 or newer and Corepack.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Useful endpoints:

- public landing page: `http://localhost:3000/`
- embedded app page: `http://localhost:3000/dashboard`
- manifest: `http://localhost:3000/api/manifest`
- MCP: the per-installation URL shown by the embedded app
- health: `http://localhost:3000/health`

Run the full verification suite with:

```bash
pnpm check
```

Run tests with an HTML and terminal coverage report using:

```bash
pnpm test:coverage
```

Schema discovery first tries live introspection for the installed Saleor instance and
falls back to the bundled `schema.graphql` from `v2`. Set `SALEOR_SCHEMA_PATH` only when
testing a different fallback SDL.
