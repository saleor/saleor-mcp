import httpx

# from saleor_mcp.core.models import MCPErrorResponse
from ..core.models import MCPErrorResponse

REQUEST_TIMEOUT = 30.0


async def saleor_api_request(
    query: str, variables: dict, authentication_token: str, saleor_api_url: str
) -> tuple[dict | None, MCPErrorResponse | None]:
    """Make a GraphQL request to the Saleor API.

    Args:
        query (str): The GraphQL query string.
        variables (dict): Variables for the GraphQL query.
        authentication_token (str): Bearer token for authentication.
        saleor_api_url (str): The URL of the Saleor GraphQL API.

    Returns:
        dict: The response data from the Saleor API.

    """

    payload = {"query": query, "variables": variables}
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {authentication_token}",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                saleor_api_url,
                json=payload,
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )

            response.raise_for_status()
            data = response.json()

            if "errors" in data:
                error = data["errors"][0].get("message", "Unknown error")
                return data, MCPErrorResponse(
                    success=False,
                    error=error,
                    message=error,
                )

            return data, None

    except httpx.HTTPStatusError as e:
        return None, MCPErrorResponse(
            success=False,
            error=f"HTTP error {e.response.status_code}: {e.response.text}",
            message="Failed to connect to Saleor",
        )
    except httpx.RequestError as e:
        return None, MCPErrorResponse(
            success=False,
            error=f"Request error: {str(e)}",
            message="Network error while connecting to Saleor",
        )
    except Exception as e:
        return None, MCPErrorResponse(
            success=False,
            error=f"Unexpected error: {str(e)}",
            message="An unexpected error occurred while fetching orders",
        )
