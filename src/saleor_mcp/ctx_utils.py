from .config import get_config_from_headers
from .saleor_client.client import Client


def get_saleor_client() -> Client:
    """Create and return a Saleor GraphQL client using configuration from headers.

    Note: This function works only within a request context.
    """
    saleor_headers = get_config_from_headers()
    headers = {"Authorization": f"Bearer {saleor_headers.auth_token}"}
    return Client(url=saleor_headers.api_url, headers=headers)
