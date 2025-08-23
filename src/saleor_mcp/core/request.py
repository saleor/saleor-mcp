import httpx

REQUEST_TIMEOUT = 30.0


class SaleorRequestError(Exception):

    def __init__(self, message: str, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code


async def make_saleor_request(
    query: str, variables: dict, authentication_token: str, saleor_api_url: str
) -> dict:
    """Make a GraphQL request to the Saleor API.

    Args:
        query (str): The GraphQL query string.
        variables (dict): Variables for the GraphQL query.
        authentication_token (str): Bearer token for authentication.
        saleor_api_url (str): The URL of the Saleor GraphQL API.

    Returns:
        dict: The response data.

    Raises:
        SaleorRequestError: If an error occurs while making the request, including
        network issues, HTTP errors, or GraphQL errors.

    """

    payload = {"query": query, "variables": variables}
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {authentication_token}",
    }

    data = {}

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
                raise SaleorRequestError(message=message, code=code)

    except httpx.HTTPStatusError as e:
        raise SaleorRequestError(
            message=f"HTTP error {e.response.status_code}: {e.response.text}",
            code=str(e.response.status_code),
        ) from e
    except httpx.RequestError as e:
        raise SaleorRequestError(
            message="Network error while connecting to Saleor",
        ) from e
    except Exception as e:
        raise SaleorRequestError(
            message=f"An unexpected error occurred while making request to Saleor: {str(e)}",
        ) from e

    return data.get("data", {})
