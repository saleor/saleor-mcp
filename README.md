# Saleor MCP Server

A Model Context Protocol (MCP) server for Saleor Commerce that provides integration with AI assistants and tools.

## Installation

### Prerequisites

- Python 3.12 or higher
- [uv](https://docs.astral.sh/uv/) package manager

### Setup

1. **Clone the repository**

   ```bash
   git clone git@github.com:saleor/saleor-mcp.git
   cd saleor-mcp
   ```

2. **Install dependencies**

   ```bash
   uv sync
   ```

3. **Run the MCP server locally**

   ```bash
   uv run saleor-mcp
   ```

   The server will start on `http://localhost:6000`

## Configuration

### `X-Saleor-API-URL` and `X-Saleor-Auth-Token` headers

The Saleor MCP server uses two headers to configure connection to the Saleor API:

- `X-Saleor-API-URL` - The URL of the Saleor API endpoint.
- `X-Saleor-Auth-Token` - The authentication token for accessing the Saleor API.

Make sure to include these headers in your requests to the MCP server.

### `ALLOWED_DOMAIN_PATTERN` env variable

The `ALLOWED_DOMAIN_PATTERN` environment variable is used to specify a regex pattern for allowed API domains that the MCP server can connect to. When set, the server will validate the `X-Saleor-API-URL` header against this pattern. If not set, any domain is allowed. Patten must include escaping for special characters.

Example: `https:\/\/.*\.saleor\.cloud\/graphql\/` - allows any subdomain of `saleor.cloud` and the `/graphql/` path.

## Development

This project uses [ariadne-codegen](https://github.com/mirumee/ariadne-codegen/) to generate Saleor API client code from the GraphQL schema. See `pyproject.toml` for configuration.
To regenerate the client locally run:

```bash
ariadne-codegen
```
