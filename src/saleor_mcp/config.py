from dataclasses import dataclass

from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_http_headers


@dataclass
class SaleorConfig:
    api_url: str
    auth_token: str


def get_config_from_headers() -> SaleorConfig:
    """Extract Saleor configuration from HTTP headers.

    Note: This function works only within a request context.
    """

    headers = get_http_headers()

    api_url = headers.get("x-saleor-api-url")
    if not api_url:
        raise ToolError("Missing X-Saleor-API-URL header")

    auth_token = headers.get("x-saleor-auth-token")
    if not auth_token:
        raise ToolError("Missing X-Saleor-Auth-Token header")

    return SaleorConfig(
        api_url=api_url,
        auth_token=auth_token,
    )
