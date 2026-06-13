import os

from fastmcp import FastMCP
from fastmcp.server.middleware.timing import DetailedTimingMiddleware
from graphql import print_schema
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from starlette.staticfiles import StaticFiles

from saleor_mcp.docs import generate_html
from saleor_mcp.introspection import get_schema
from saleor_mcp.tools import gateway_router

mcp = FastMCP("Saleor MCP Server")
mcp.add_middleware(DetailedTimingMiddleware())
mcp.mount(gateway_router)


@mcp.resource(
    "saleor://schema/graphql",
    name="Saleor GraphQL schema (SDL)",
    mime_type="text/plain",
)
async def schema_sdl() -> str:
    """Return the connected instance's GraphQL schema as SDL.

    Sourced from live introspection when available, otherwise the bundled schema.
    """
    schema = await get_schema()
    return print_schema(schema)


@mcp.prompt(name="explore_saleor")
def explore_saleor() -> str:
    """Guidance for exploring and operating a Saleor instance via this server."""
    return (
        "You are connected to a Saleor Commerce instance through a generic GraphQL "
        "gateway. Work in this loop:\n"
        "1. Call 'connection_info' to see the instance, the token's permissions and "
        "whether writes are enabled.\n"
        "2. Use 'introspect_schema' to discover what's available: 'search' by keyword, "
        "'list_operations' for queries/mutations, then 'describe_operation' and "
        "'describe_type' to learn exact arguments and fields.\n"
        "3. Run reads with 'run_query' and writes with 'run_mutation'. Always request "
        "only the fields you need.\n"
        "Remember: you can only do what the token's permissions allow, and mutations "
        "are additionally subject to the server's safety policy (read_only by "
        "default). Read GraphQL 'errors' in responses to self-correct."
    )


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
    html_content = await generate_html()

    return HTMLResponse(
        content=html_content,
        headers={"Content-Security-Policy": "; ".join(csp_policies)},
    )


app = mcp.http_app(stateless_http=True)
app.mount("/static", StaticFiles(directory="src/saleor_mcp/static"), name="static")


def main():
    transport = os.getenv("SALEOR_MCP_TRANSPORT", "http").lower()

    if transport == "stdio":
        # Local power-user mode: connection config comes from environment variables.
        # Disable the banner so it cannot corrupt the stdio JSON-RPC stream.
        mcp.run(transport="stdio", show_banner=False)
        return

    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "6000"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
