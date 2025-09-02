from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

from saleor_mcp.tools import (
    channels_router,
    orders_router,
    products_router,
    utils_router,
)

mcp = FastMCP("Saleor MCP Server")
mcp.mount(channels_router)
mcp.mount(orders_router)
mcp.mount(products_router)
mcp.mount(utils_router)


@mcp.custom_route("/health", methods=["GET"])
async def health_check(request: Request):
    return JSONResponse({"status": "healthy"})


app = mcp.http_app(stateless_http=True)


def main():
    mcp.run(transport="http", host="127.0.0.1", port=6000)


if __name__ == "__main__":
    main()
