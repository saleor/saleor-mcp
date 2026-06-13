# Testing the MCP with a local Saleor and Claude Code

This guide shows how to run the Saleor MCP server locally over **stdio** and connect it
to [Claude Code](https://docs.anthropic.com/en/docs/claude-code) so you can drive your
own Saleor instance through GraphQL.

Running locally keeps a write-capable token on your machine — it only ever flows to your
own Saleor instance, never through a shared host.

## Prerequisites

- A Saleor instance running locally, e.g. with
  [`saleor-platform`](https://github.com/saleor/saleor-platform). The GraphQL endpoint
  is typically `http://localhost:8000/graphql/` and the dashboard
  `http://localhost:9000`.
- The `claude` CLI installed (`claude --version`).
- This repo cloned and synced:

  ```bash
  uv sync
  ```

  This creates the launcher at `.venv/bin/saleor-mcp`.

## Step 1 — Get a Saleor access token

The MCP acts as whatever token you give it, so the token's permissions are your primary
access control. Pick one of the options below.

### Option A — App token (recommended, permanent)

The cleanest token for ongoing testing is a **local App token**, which does not expire.

Via the dashboard: open `http://localhost:9000` → **Configuration → Webhooks & Events /
Apps**, create a local app, assign the permissions you want the assistant to have, and
copy its token.

Or bootstrap one from the CLI — mint a short-lived staff JWT and immediately use it to
create an app (with the default `saleor-platform` admin `admin@example.com` / `admin`):

```bash
API=http://localhost:8000/graphql/
JWT=$(curl -s "$API" -H 'Content-Type: application/json' \
  -d '{"query":"mutation{tokenCreate(email:\"admin@example.com\",password:\"admin\"){token}}"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["tokenCreate"]["token"])')

# Create a local app and print its permanent token. Adjust the permission list as needed;
# note MANAGE_APPS cannot be granted to an app.
TOKEN=$(curl -s "$API" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT" \
  -d '{"query":"mutation{appCreate(input:{name:\"MCP Local\",permissions:[MANAGE_PRODUCTS,MANAGE_ORDERS,MANAGE_CHANNELS,MANAGE_DISCOUNTS,MANAGE_GIFT_CARD,MANAGE_USERS,MANAGE_STAFF,MANAGE_SHIPPING,MANAGE_SETTINGS,MANAGE_TRANSLATIONS,MANAGE_PAGES,MANAGE_PLUGINS,MANAGE_TAXES]}){authToken errors{field message code}}}"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["appCreate"]["authToken"])')
echo "$TOKEN"
```

### Option B — Staff JWT (quick, expires in 5 minutes)

For a one-off smoke test you can use a staff JWT directly. Note the access token is only
valid for **5 minutes**, so it is not suitable for a persistent registration:

```bash
TOKEN=$(curl -s http://localhost:8000/graphql/ \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation{tokenCreate(email:\"admin@example.com\",password:\"admin\"){token errors{message}}}"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["tokenCreate"]["token"])')
echo "$TOKEN"
```

> If calls start failing with an authentication error, the JWT has expired — switch to an
> App token (Option A).

## Step 2 — Register the MCP with Claude Code

Add the server over stdio, passing the connection and policy as environment variables.
**Use an absolute path to the launcher** — the easiest way is to run the command from
your checkout so `"$(pwd)"` expands to it. Make sure `$TOKEN` is set from Step 1:

```bash
cd /path/to/saleor-mcp   # your checkout

claude mcp add saleor-local -s user \
  -e SALEOR_MCP_TRANSPORT=stdio \
  -e SALEOR_API_URL=http://localhost:8000/graphql/ \
  -e SALEOR_AUTH_TOKEN="$TOKEN" \
  -e SALEOR_MCP_MODE=read_write \
  -- "$(pwd)/.venv/bin/saleor-mcp"
```

> Do not paste the literal `"$(pwd)/.venv/bin/saleor-mcp"` from a different directory, and
> do not leave a placeholder like `/ABSOLUTE/PATH/TO/...` — Claude Code stores the command
> verbatim, so a wrong path shows up as `✘ Failed to connect`.

Notes:

- `-s user` makes the server available in all your projects. Use `-s local` (the default)
  to scope it to the current project, or `-s project` to share it via a checked-in
  `.mcp.json`.
- Alternative launch command (if you prefer `uv` to manage the environment), using the
  absolute repo path:

  ```bash
  -- uv run --directory "$(pwd)" saleor-mcp
  ```

### Safety mode

`SALEOR_MCP_MODE` controls whether mutations are allowed:

| Mode | Behaviour |
| --- | --- |
| `read_only` (default) | Only `run_query` works; mutations are disabled. |
| `read_write` | Mutations allowed, except a built-in high-risk denylist. |
| `unrestricted` | Any mutation the token permits can run; no denylist. |

The example above uses `read_write` so you can test mutations. See the
[README](../README.md#safety-policy) for the denylist and how to override it.

## Step 3 — Verify the connection

Check the server is registered and reachable:

```bash
claude mcp list
```

`saleor-local` should appear as connected. Then start a Claude Code session and try:

1. **`connection_info`** — confirms the instance URL, the token's permissions, the
   active mode, and which mutations are blocked.
2. **`run_query`** — a read, for example:

   ```graphql
   query { channels { id name currencyCode } }
   ```

3. **`introspect_schema`** — discovery, e.g. action `list_operations` with kind
   `mutation` and search `product`.
4. **`run_mutation`** — a write (requires `read_write` or `unrestricted`), for example
   updating a product's metadata.

A natural prompt to kick things off:

> Using the Saleor MCP, call connection_info, then list my channels, then show me the
> available product mutations.

## Troubleshooting

- **`Missing Saleor API URL` / `Missing Saleor auth token`** — the `SALEOR_API_URL` /
  `SALEOR_AUTH_TOKEN` env vars weren't passed. Re-check the `claude mcp add` command.
- **`read_only mode, so mutations are disabled`** — set `SALEOR_MCP_MODE=read_write`
  (or `unrestricted`) and re-add the server.
- **`blocked by the current safety policy`** — the mutation is on the default denylist.
  Add it to `SALEOR_MCP_ALLOWED_MUTATIONS` (comma-separated) or use `unrestricted`.
- **Authentication errors mid-session** — a JWT likely expired; mint a new one
  (Step 1, Option B) or switch to an App token (Option A).
- **`API URL ... is not allowed`** — `ALLOWED_DOMAIN_PATTERN` is set and excludes
  `localhost`. Unset it for local testing, or include `localhost` in the pattern.
- **`✘ Failed to connect` in `claude mcp list`** — almost always a wrong launcher path
  (e.g. a leftover `/ABSOLUTE/PATH/TO/...` placeholder, or a path added from a different
  directory). Run `claude mcp get saleor-local` to see the stored command, confirm the
  binary exists (`ls "$(pwd)/.venv/bin/saleor-mcp"` from your checkout), then remove and
  re-add with the correct absolute path. If the name is defined in multiple scopes, the
  diagnostics will say so — remove the stale one (e.g. `claude mcp remove saleor-local -s local`).
- **Server fails to start** — confirm the launcher path exists
  (`ls "$(pwd)/.venv/bin/saleor-mcp"` from your checkout) and that `uv sync` has been run.

To update settings later, remove and re-add the server (match the scope you used):

```bash
claude mcp remove saleor-local -s user
```
