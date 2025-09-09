from datetime import UTC, datetime

from fastmcp import FastMCP

from ..config import get_config_from_headers

utils_router = FastMCP("Utils MCP")


@utils_router.tool()
def current_domain() -> str:
    """Return the current domain of the application."""

    headers = get_config_from_headers()
    return headers.api_url


@utils_router.tool()
def current_date_time() -> str:
    """Return the current date and time in ISO 8601 format in UTC timezone."""

    return datetime.now(UTC).isoformat()
