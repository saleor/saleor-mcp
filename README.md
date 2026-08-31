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
   checks that its app ID and token fingerprint still match, and uses the server-side app
   token for Saleor.

Uninstalling, reinstalling, or rotating the Saleor app token invalidates the old connection,
even if a numeric app ID is reused. Rotating the RSA key pair invalidates every issued MCP
connection for that deployment.

## Install in Saleor

Deploy the app, then use this URL in **Dashboard → Apps → Install external app**:

```text
https://your-deployment.example/api/manifest
```

The app installs without Saleor permissions. After installation, open **Saleor MCP** from
Apps. A user with `MANAGE_APPS` chooses which parts of Saleor the MCP may access, reviews
the exact permission request in Dashboard, and then copies the ready-to-use HTTP MCP
configuration. The approved Saleor permissions are the app token's access ceiling.

## Deployment configuration

Copy `.env.example` and configure:

| Variable                     | Purpose                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `APL_PROVIDER`               | `file` for local development or `dynamodb` for the Saleor SDK adapter.      |
| `APL_DYNAMODB_TABLE`         | DynamoDB table used when `APL_PROVIDER=dynamodb`.                           |
| `AWS_REGION`                 | Region for the DynamoDB client. Standard AWS credential discovery is used.  |
| `MCP_CREDENTIAL_PRIVATE_KEY` | PKCS8 RSA private key used to sign MCP installation credentials with RS512. |
| `MCP_CREDENTIAL_PUBLIC_KEY`  | SPKI RSA public key used to verify MCP installation credentials.            |
| `APP_IFRAME_BASE_URL`        | Optional public iframe URL override for local tunnels.                      |
| `APP_API_BASE_URL`           | Optional public API URL override for local tunnels.                         |
| `ALLOWED_DOMAIN_PATTERN`     | Required full-match regex for Saleor API URLs allowed to install the app.   |

Generate the credential key pair once for each deployment:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out mcp-private.pem
openssl pkey -in mcp-private.pem -pubout -out mcp-public.pem
```

Store the full PEM values in the matching environment variables and do not commit the
private key. Escaped `\n` line breaks are accepted when the deployment platform cannot
store multiline values.

The Saleor SDK DynamoDB APL expects a table with string partition key `PK` and string
sort key `SK`. The app needs `GetItem`, `PutItem`, `DeleteItem`, and `Scan` access to
that table. APL selection is isolated behind `src/lib/apl`, so another persistent
implementation can replace it without changing registration or MCP code.

`FileAPL` is blocked in production because Vercel's filesystem is not persistent.
Vercel needs no custom Next.js build setup; configure the environment variables and
deploy the repository normally.

## Safety policy

`ALLOWED_DOMAIN_PATTERN` fails closed: when it is missing or empty, every installation
is rejected before the app contacts the supplied URL.

`SALEOR_MCP_MODE` controls the deployment-wide write policy. Both modes fail closed:

| Mode         | Behavior                                                         |
| ------------ | ---------------------------------------------------------------- |
| `read_only`  | Queries only. This is the default.                               |
| `read_write` | Only mutations explicitly named in the deployment allowlist run. |

Set comma-separated `SALEOR_MCP_ALLOWED_MUTATIONS` when using `read_write`. An empty
allowlist permits no mutations, and new Saleor mutations stay disabled until they are
explicitly reviewed and added. The installed app's Saleor permissions are always the
final ceiling.

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
