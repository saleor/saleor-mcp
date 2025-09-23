# Saleor MCP Server

A Model Context Protocol (MCP) server for Saleor Commerce that provides integration with AI assistants and tools.

## Getting Started

The Saleor MCP server allows AI assistants to interact with Saleor instance in order to fetch data about products, customers, and orders. The MCP is read-only - it doesn't trigger any mutations in the Saleor API.

Easiest way to try out the Saleor MCP server is by visiting the production instance deployed at:

https://mcp.saleor.app/

You can connect to the server with Streamable HTTP at `https://mcp.saleor.app/mcp` endpoint. See the Configuration section below for details on required headers. The production instance is configured to connect to Saleor instances hosted on `saleor.cloud` domain and it's compatible with Saleor 3.22.

## Installation

The following instructions will help you set up the Saleor MCP server locally for development and testing purposes.

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
- `X-Saleor-Auth-Token` - The authentication token for accessing the Saleor API. The token must have `MANAGE_PRODUCTS` and `MANAGE_ORDERS` permissions to access the available tools.

Make sure to include these headers in your requests to the MCP server.

### `ALLOWED_DOMAIN_PATTERN` env variable

The `ALLOWED_DOMAIN_PATTERN` environment variable is used to specify a regex pattern for allowed API domains that the MCP server can connect to. When set, the server will validate the `X-Saleor-API-URL` header against this pattern. If not set, any domain is allowed. Patten must include escaping for special characters.

Example: `https:\/\/.*\.saleor\.cloud\/graphql\/` - allows any subdomain of `saleor.cloud` and the `/graphql/` path.

## Integration with AI Assistants

Saleor MCP can be enabled in AI assistants that support integration with custom MCP servers using Streamable HTTP and setting the appropriate headers.

Below is the example configuration for VSCode / Copilot using `mcp.json` file:

```json
{
  "servers": {
    "saleor-mcp": {
      "type": "http",
      "url": "https://mcp.saleor.app/mcp",
      "headers": {
        "X-Saleor-Auth-Token": "eyJhb...",
        "X-Saleor-API-URL": "https://example.saleor.cloud/graphql/"
      }
    }
  }
}
```

## Development

This project uses [ariadne-codegen](https://github.com/mirumee/ariadne-codegen/) to generate Saleor API client code from the GraphQL schema. See `pyproject.toml` for configuration.
To regenerate the client locally run:

```bash
ariadne-codegen
```
