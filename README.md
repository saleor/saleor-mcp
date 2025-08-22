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

## Testing with MCP Inspector

To test the MCP server using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) tool:

1. **Install MCP Inspector**
   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. **Connect to your local MCP server**
   - Open the MCP Inspector in your browser (usually at `http://localhost:5173`)
   - Add a new server connection with the following configuration:
     - **Transport**: Streamable HTTP
     - **URL**: `http://localhost:6000/mcp`

3. **Test the connection**
   - Click "Connect" to establish connection with your MCP server
   - Explore available tools and resources in the inspector interface
   - Test MCP calls and verify responses
