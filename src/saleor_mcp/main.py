from fastmcp import FastMCP
from fastmcp.server.middleware.timing import DetailedTimingMiddleware
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from starlette.staticfiles import StaticFiles

from saleor_mcp.docs import generate_html
from saleor_mcp.tools import (
    channels_router,
    customers_router,
    orders_router,
    products_router,
    utils_router,
)

mcp = FastMCP("Saleor MCP Server")
mcp.add_middleware(DetailedTimingMiddleware())
mcp.mount(channels_router)
mcp.mount(customers_router)
mcp.mount(orders_router)
mcp.mount(products_router)
mcp.mount(utils_router)


@mcp.custom_route("/health", methods=["GET"])
async def health_check(request: Request):
    return JSONResponse({"status": "healthy"})


@mcp.custom_route("/", methods=["GET"])
async def index(request: Request):
    csp_policies = (
        "default-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self'",
        "font-src 'self'",
    )

    # Generate HTML dynamically from template
    html_content = generate_html()

    return HTMLResponse(
        content=html_content,
        headers={"Content-Security-Policy": "; ".join(csp_policies)},
    )


app = mcp.http_app(stateless_http=True)
app.mount("/static", StaticFiles(directory="src/saleor_mcp/static"), name="static")


def main():
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=6000)


if __name__ == "__main__":
    main()
