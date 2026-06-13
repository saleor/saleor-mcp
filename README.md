# Saleor MCP Server

A Model Context Protocol (MCP) server for Saleor Commerce. It exposes your Saleor
GraphQL API to AI assistants (Claude Code, Cursor, VS Code / Copilot, etc.) through a
small set of **generic** tools, instead of a fixed catalogue of pre-built operations.

The assistant becomes the harness: it discovers the schema and runs arbitrary GraphQL
queries and mutations on your behalf. What it can actually do is bounded by two things:

1. **Your access token's permissions** — the server only ever acts as the token you
   give it.
2. **The server's safety policy** — a configurable mode plus a denylist of high-risk
   mutations (see [Safety policy](#safety-policy)).

## Tools

| Tool | Purpose |
| --- | --- |
| `connection_info` | Report the connected instance, the token's permissions and the active safety policy. Call this first. |
| `introspect_schema` | Explore the schema in small slices: `search`, `list_operations`, `describe_operation`, `describe_type`. |
| `run_query` | Execute a read-only GraphQL query. Mutations are rejected. |
| `run_mutation` | Execute a GraphQL mutation, subject to the safety policy. |

It also exposes the full schema as an MCP resource (`saleor://schema/graphql`) and an
`explore_saleor` prompt describing the discover → query → mutate workflow.

## Connecting

The server resolves the Saleor connection from either environment variables (used by
the local **stdio** transport) or HTTP headers (used by the hosted **Streamable HTTP**
transport). Headers take precedence when present.

| Setting | Environment variable | HTTP header |
| --- | --- | --- |
| Saleor GraphQL URL | `SALEOR_API_URL` | `X-Saleor-API-URL` |
| Saleor auth token | `SALEOR_AUTH_TOKEN` | `X-Saleor-Auth-Token` |

Create the token in Saleor (e.g. a staff/app access token) with exactly the
permissions you want the assistant to have — that token scope is your primary control.

### Local install (stdio) — recommended for power users

Running locally keeps a write-capable token on your machine: it only ever flows to
your own Saleor instance, never through a shared host. Example Claude Code
configuration (`.mcp.json` or `claude mcp add`):

```json
{
  "mcpServers": {
    "saleor": {
      "command": "uvx",
      "args": ["--from", "saleor-mcp", "saleor-mcp"],
      "env": {
        "SALEOR_MCP_TRANSPORT": "stdio",
        "SALEOR_API_URL": "https://example.saleor.cloud/graphql/",
        "SALEOR_AUTH_TOKEN": "eyJhb...",
        "SALEOR_MCP_MODE": "read_write"
      }
    }
  }
}
```

When run from a checkout, the command is `uv run saleor-mcp` with the same `env`.

### Hosted (Streamable HTTP)

Connect to a deployed instance and pass the connection via headers. Example VS Code /
Copilot `mcp.json`:

```json
{
  "servers": {
    "saleor-mcp": {
      "type": "http",
      "url": "https://mcp.saleor.app/mcp",
      "headers": {
        "X-Saleor-API-URL": "https://example.saleor.cloud/graphql/",
        "X-Saleor-Auth-Token": "eyJhb..."
      }
    }
  }
}
```

> Note: over hosted HTTP the safety mode is `read_only` unless the deployment is
> configured otherwise, and your token transits the hosted server. For write or admin
> workloads with a powerful token, prefer the local stdio install.

## Safety policy

Mutations are gated by `SALEOR_MCP_MODE` (default `read_only`):

| Mode | Behaviour |
| --- | --- |
| `read_only` | Only `run_query` works. Mutations are disabled. **Default.** |
| `read_write` | Mutations allowed, except a built-in denylist of high-risk operations. |
| `unrestricted` | Any mutation the token permits can run. No denylist. |

In `read_write` mode the default denylist blocks operations that touch identity,
access control, app installation, authentication and instance-wide settings (e.g.
`staffDelete`, `permissionGroupUpdate`, `appInstall`, `tokenCreate`,
`shopSettingsUpdate`). Adjust it with:

- `SALEOR_MCP_ALLOWED_MUTATIONS` — comma-separated names to remove from the denylist.
- `SALEOR_MCP_BLOCKED_MUTATIONS` — comma-separated names to add to the denylist.

The token's permissions are always the final authority; the policy is defence in depth
to prevent accidental, hard-to-reverse changes.

### `ALLOWED_DOMAIN_PATTERN`

A regex restricting which API domains the server may connect to. When set, the resolved
API URL is validated against it. Special characters must be escaped.

Example: `https:\/\/.*\.saleor\.cloud\/graphql\/` allows any `saleor.cloud` subdomain
with the `/graphql/` path.

## Installation (from source)

### Prerequisites

- Python 3.12 or higher
- [uv](https://docs.astral.sh/uv/) package manager

### Setup

```bash
git clone git@github.com:saleor/saleor-mcp.git
cd saleor-mcp
uv sync
```

Run over HTTP (default):

```bash
uv run saleor-mcp        # serves on http://localhost:6000 (override with HOST/PORT)
```

Run over stdio:

```bash
SALEOR_MCP_TRANSPORT=stdio \
SALEOR_API_URL=https://example.saleor.cloud/graphql/ \
SALEOR_AUTH_TOKEN=... \
uv run saleor-mcp
```

## Development

Run tests and lint:

```bash
uv run pytest
uv run ruff check src
```

Schema discovery uses **live introspection** of the connected instance, falling back to
the bundled `schema.graphql` when introspection is unavailable. To refresh the bundled
schema, replace `schema.graphql` with the SDL from your target Saleor version (or set
`SALEOR_SCHEMA_PATH` to point at a different file).
