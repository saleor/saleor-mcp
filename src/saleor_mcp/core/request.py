import httpx

REQUEST_TIMEOUT = 30.0


async def make_saleor_request(
    query: str, variables: dict, authentication_token: str, saleor_api_url: str
) -> tuple[dict | None, dict | None]:
    """Make a GraphQL request to the Saleor API.

    Args:
        query (str): The GraphQL query string.
        variables (dict): Variables for the GraphQL query.
        authentication_token (str): Bearer token for authentication.
        saleor_api_url (str): The URL of the Saleor GraphQL API.

    Returns:
        tuple[dict | None, MCPErrorResponse | None]: The response data and any error information.

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
                error = data["errors"][0]
                message = error.get("message", "Unknown error")
                code = error.get("extensions", {}).get("exception", {}).get("code")
                return None, {"code": code, "message": message, "success": False}

            data = data.get("data", {})
            return data, None

    except httpx.HTTPStatusError as e:
        return None, {
            "code": str(e.response.status_code),
            "message": f"HTTP error {e.response.status_code}: {e.response.text}",
            "success": False,
        }
    except httpx.RequestError:
        return None, {
            "message": "Network error while connecting to Saleor",
            "success": False,
        }
    except Exception as e:
        return None, {
            "message": f"An unexpected error occurred while making request to Saleor: {str(e)}",
            "success": False,
        }
