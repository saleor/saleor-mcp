from fastmcp import FastMCP

from .orders import orders_router

mcp = FastMCP("Saleor MCP Server")
mcp.mount(orders_router)

app = mcp.http_app
