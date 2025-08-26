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

The MCP server requires certain HTTP headers to be set for authentication and API access. These headers include:

- `X-Saleor-API-URL`: The URL of the Saleor API endpoint.
- `X-Saleor-Auth-Token`: The authentication token for accessing the Saleor API.

Make sure to include these headers in your requests to the MCP server.
