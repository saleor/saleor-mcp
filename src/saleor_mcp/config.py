import os
import re
from dataclasses import dataclass

from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_http_headers


def validate_api_url(url, pattern):
    """Validate if the given URL matches the allowed domain pattern.

    Pattern should be a properly escaped regular expression.
    """
    # Add anchors if not present
    if not pattern.startswith("^"):
        pattern = "^" + pattern

    if not pattern.endswith("$"):
        pattern = pattern + "$"

    return bool(re.match(pattern, url))


@dataclass
class SaleorConfig:
    api_url: str
    auth_token: str


def get_config_from_headers() -> SaleorConfig:
    """Extract Saleor configuration from HTTP headers.

    Note: This function works only within a request context.
    """

    allowed_domain_pattern = os.getenv("ALLOWED_DOMAIN_PATTERN", "")
    headers = get_http_headers()

    api_url = headers.get("x-saleor-api-url")
    if not api_url:
        raise ToolError("Missing X-Saleor-API-URL header")

    if allowed_domain_pattern and not validate_api_url(api_url, allowed_domain_pattern):
        raise ToolError(f"API URL '{api_url}' is not allowed")

    auth_token = headers.get("x-saleor-auth-token")
    if not auth_token:
        raise ToolError("Missing X-Saleor-Auth-Token header")

    return SaleorConfig(
        api_url=api_url,
        auth_token=auth_token,
    )
