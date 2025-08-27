from fastmcp import FastMCP

from saleor_mcp.tools import orders_router, utils_router

mcp = FastMCP("Saleor MCP Server")
mcp.mount(orders_router)
mcp.mount(utils_router)

app = mcp.http_app()


def main():
    mcp.run(transport="http", host="127.0.0.1", port=6000)


if __name__ == "__main__":
    main()
