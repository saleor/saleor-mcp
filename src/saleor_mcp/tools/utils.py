from fastmcp import FastMCP

from ..config import get_config_from_headers

utils_router = FastMCP("Utils MCP")


@utils_router.tool()
def current_domain() -> str:
    """Return the current domain of the connected Saleor instance."""

    headers = get_config_from_headers()
    return headers.api_url
