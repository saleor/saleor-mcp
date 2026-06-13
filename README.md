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

What the assistant can do is bounded by two things: your **token's permissions** and
the server's **safety policy** (see [Safety policy](#safety-policy)).

There are two ways to run the server:

- **Local install (recommended)** — runs on your machine over **stdio**. Your token
  only ever travels from your machine directly to your own Saleor instance.
- **Hosted** — a shared **Streamable HTTP** endpoint, handy for a quick read-only try
  without installing anything. Your token transits the hosted server, so it runs
  `read_only` by default.

Connection settings come from environment variables (local/stdio) or HTTP headers
(hosted); headers take precedence when both are present:

| Setting | Environment variable | HTTP header |
| --- | --- | --- |
| Saleor GraphQL URL | `SALEOR_API_URL` | `X-Saleor-API-URL` |
| Saleor auth token | `SALEOR_AUTH_TOKEN` | `X-Saleor-Auth-Token` |

### Get a Saleor token

The token's permissions are the ceiling on what the assistant can do, so create one
scoped to exactly what you want to allow. **Prefer an App token:** in your Saleor
Dashboard create an App, grant it only the permissions
you are comfortable giving an AI assistant, and copy its access token. App tokens are
long-lived, scoped, and revocable — deactivate or delete the App to revoke access.

Avoid using a staff login token (the JWT from `tokenCreate`) here, as it expires after a
few minutes.

### Local install (stdio) — recommended

**Prerequisite:** install [uv](https://docs.astral.sh/uv/). It is a single binary and
also manages Python for you, so nothing else is required:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # macOS/Linux
# or: brew install uv   /   winget install astral-sh.uv
```

Then point your MCP client at the server with `uvx`, which fetches and runs it on
demand. The client launches the command for you — you only add the config
block. Example Claude Code configuration (`.mcp.json` or `claude mcp add`):

```json
{
  "mcpServers": {
    "saleor": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/saleor/saleor-mcp",
        "saleor-mcp"
      ],
      "env": {
        "SALEOR_MCP_TRANSPORT": "stdio",
        "SALEOR_API_URL": "https://example.saleor.cloud/graphql/",
        "SALEOR_AUTH_TOKEN": "<your token>",
        "SALEOR_MCP_MODE": "read_write"
      }
    }
  }
}
```

Or add it in one command with the Claude Code CLI (`-s user` makes it available in
every project; drop it to add only to the current one):

```bash
claude mcp add saleor -s user \
  -e SALEOR_MCP_TRANSPORT=stdio \
  -e SALEOR_API_URL=https://example.saleor.cloud/graphql/ \
  -e SALEOR_AUTH_TOKEN=<your token> \
  -e SALEOR_MCP_MODE=read_write \
  -- uvx --from git+https://github.com/saleor/saleor-mcp saleor-mcp
```

Pin to a specific release by appending a tag, e.g.
`git+https://github.com/saleor/saleor-mcp@0.2.0`. The same config works in Cursor and
VS Code / Copilot under their respective `mcpServers` / `servers` keys. When run from a
checkout instead, the command is `uv run saleor-mcp` with the same `env`.

For a full local walkthrough (running against a local Saleor and wiring it into Claude
Code), see [docs/testing-with-claude-code.md](docs/testing-with-claude-code.md).

### Hosted (Streamable HTTP) — quick read-only trial

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
        "X-Saleor-Auth-Token": "<your token>"
      }
    }
  }
}
```

> The hosted endpoint runs `read_only`, and your token transits the shared server. For
> write or admin workloads with a powerful token, use the local install above.

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

A regex restricting which API URLs the server may connect to. The resolved API URL
must be a well-formed `http(s)` URL, and when this is set the **full URL** must fully
match the pattern (it is anchored at both ends). Special characters must be escaped.

Example: `^https://([A-Za-z0-9._-]+)\.saleor\.cloud/graphql/$` allows any `saleor.cloud`
subdomain on the `/graphql/` path.

> **Use a restrictive character class for the host — never `.*`.** Because `.*` also
> matches `/`, a pattern like `^https://.*\.saleor\.cloud/` is spoofable by an
> attacker-controlled path such as `https://evil.example/.saleor.cloud/`, turning the
> server into an SSRF relay. The `[A-Za-z0-9._-]+` class above cannot cross the
> host/path boundary, so path-, userinfo- (`@`) and suffix-based spoofs are all
> rejected.

> **Production requirement:** on a hosted/public endpoint the API URL is supplied by
> the client, so leaving this unset turns the server into an SSRF relay (it will
> connect to any host, including internal addresses). Always set it in production. It
> may be left unset only for local stdio use, where the URL is operator-controlled; the
> server logs a warning when it is unset.

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
