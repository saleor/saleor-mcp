# Saleor MCP Server

A hosted Model Context Protocol (MCP) server for Saleor Commerce, packaged as a
multi-tenant Saleor App. It gives AI assistants four generic tools for discovering and
using a Saleor GraphQL API instead of maintaining a fixed catalogue of actions.

## MCP tools

| Tool                | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `connection_info`   | Report the installation, app permissions, and active safety policy. |
| `introspect_schema` | Search and describe schema types, queries, and mutations.           |
| `run_query`         | Run read-only GraphQL. Mutation documents are rejected.             |
| `run_mutation`      | Run GraphQL mutations subject to the safety policy.                 |

The server also exposes the `saleor://schema/graphql` resource and the
`explore_saleor` prompt. GraphQL tool results preserve Saleor's raw `data` and `errors`.

## How authentication works

1. Saleor reads `/api/manifest` and posts the app token to `/api/register` during
   installation.
2. The standard Saleor Auth Persistence Layer (APL) stores the app token. It never
   reaches the browser or MCP client.
3. A Dashboard user with `MANAGE_APPS` opens the installed app and copies an MCP
   configuration containing a separate signed installation credential.
4. Requests send that credential as `Authorization: Bearer <credential>` to `/mcp`.
5. The server verifies the signature, loads the matching installation from the APL,
   checks that its app ID still matches, and uses the server-side app token for Saleor.

Uninstalling or reinstalling the app invalidates the old connection because the stored
installation or app ID changes. Rotating `MCP_CREDENTIAL_SECRET` invalidates every
issued MCP connection for that deployment.

## Install in Saleor

Deploy the app, then use this URL in **Dashboard → Apps → Install external app**:

```text
https://your-deployment.example/api/manifest
```

After installation, open **Saleor MCP** from Apps. A user with `MANAGE_APPS` can copy
the ready-to-use HTTP MCP configuration. The fixed manifest permission set covers
ordinary catalogue, checkout, order, discount, gift-card, content, shipping, tax,
payment, and translation work. It deliberately excludes staff/customer identity,
app management, plugins, channels, observability, and instance-wide settings.

## Deployment configuration

Copy `.env.example` and configure:

| Variable                 | Purpose                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| `APL_PROVIDER`           | `file` for local development or `dynamodb` for the Saleor SDK adapter.         |
| `APL_DYNAMODB_TABLE`     | DynamoDB table used when `APL_PROVIDER=dynamodb`.                              |
| `AWS_REGION`             | Region for the DynamoDB client. Standard AWS credential discovery is used.     |
| `MCP_CREDENTIAL_SECRET`  | At least 32 random characters used to sign MCP installation credentials.       |
| `APP_IFRAME_BASE_URL`    | Optional public iframe URL override for local tunnels.                         |
| `APP_API_BASE_URL`       | Optional public API URL override for local tunnels.                            |
| `ALLOWED_DOMAIN_PATTERN` | Optional full-match regex limiting Saleor API URLs allowed to install the app. |

The Saleor SDK DynamoDB APL expects a table with string partition key `PK` and string
sort key `SK`. The app needs `GetItem`, `PutItem`, `DeleteItem`, and `Scan` access to
that table. APL selection is isolated behind `src/lib/apl`, so another persistent
implementation can replace it without changing registration or MCP code.

`FileAPL` is blocked in production because Vercel's filesystem is not persistent.
Vercel needs no custom Next.js build setup; configure the environment variables and
deploy the repository normally.

## Safety policy

`SALEOR_MCP_MODE` controls the deployment-wide write policy. The `read_write` mode
fails closed:

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

Requirements: Node.js 24 or newer and Corepack.

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
- MCP: `http://localhost:3000/mcp`
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
falls back to the bundled `schema.graphql`. Set `SALEOR_SCHEMA_PATH` only when testing a
different fallback SDL.
