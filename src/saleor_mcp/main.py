from fastmcp import FastMCP

from saleor_mcp.tools import orders_router

mcp = FastMCP("Saleor MCP Server")
mcp.mount(orders_router)

app = mcp.http_app


def main():
    mcp.run(transport="http", host="0.0.0.0", port=6000)


if __name__ == "__main__":
    main()
