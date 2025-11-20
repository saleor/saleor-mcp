from .config import get_config_from_headers
from .saleor_client.client import Client
from .saleor_client.graphql_client import instrument_graphql_client


def get_saleor_client():
    """Create and return a Saleor GraphQL client using configuration from headers.

    Note: This function works only within a request context.
    """

    saleor_headers = get_config_from_headers()
    headers = {"Authorization": f"Bearer {saleor_headers.auth_token}"}
    client = Client(url=saleor_headers.api_url, headers=headers)
    return instrument_graphql_client(client)
