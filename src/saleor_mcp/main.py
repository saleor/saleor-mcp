from fastmcp import FastMCP

from saleor_mcp.orders import orders_router

mcp = FastMCP("Saleor MCP Server")
mcp.mount(orders_router)


def main():
    mcp.run(transport="http", host="0.0.0.0", port=6000)


if __name__ == "__main__":
    main()
