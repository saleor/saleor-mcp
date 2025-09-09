from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse

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


@mcp.custom_route("/", methods=["GET"])
async def index(request: Request):
    content = """
        <html>
            <head>
                <title>Saleor MCP Server</title>
            </head>
            <body>
                <h1>Saleor MCP is running</h1>
                <p>Use the /mcp endpoint to connect to the server with Streamable HTTP transport.</p>
            </body>
        </html>
        """
    return HTMLResponse(content)


app = mcp.http_app()


def main():
    mcp.run(transport="http", host="127.0.0.1", port=6000)


if __name__ == "__main__":
    main()
