"""Thin async GraphQL client for executing arbitrary documents against Saleor."""

from typing import Any

import httpx

from .config import SaleorConfig, get_saleor_config

DEFAULT_TIMEOUT = 30.0


class SaleorGraphQLError(Exception):
    """Raised when the Saleor API returns transport or GraphQL errors."""

    def __init__(self, message: str, *, errors: list[dict[str, Any]] | None = None):
        super().__init__(message)
        self.errors = errors or []


async def execute_graphql(
    query: str,
    variables: dict[str, Any] | None = None,
    *,
    config: SaleorConfig | None = None,
    operation_name: str | None = None,
) -> dict[str, Any]:
    """Execute a GraphQL document against the configured Saleor instance.

    Returns the raw JSON response body, preserving both ``data`` and ``errors`` so
    callers (and the agent) can inspect partial results and GraphQL-level errors.
    Raises :class:`SaleorGraphQLError` only for transport/HTTP failures.
    """
    config = config or get_saleor_config()
    payload: dict[str, Any] = {"query": query, "variables": variables or {}}
    if operation_name:
        payload["operationName"] = operation_name

    headers = {
        "Authorization": f"Bearer {config.auth_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        try:
            response = await client.post(
                config.api_url, json=payload, headers=headers
            )
        except httpx.HTTPError as exc:
            raise SaleorGraphQLError(
                f"Failed to reach Saleor API at {config.api_url}: {exc}"
            ) from exc

    if response.status_code >= 400:
        raise SaleorGraphQLError(
            f"Saleor API returned HTTP {response.status_code}: {response.text[:500]}"
        )

    try:
        body = response.json()
    except ValueError as exc:
        raise SaleorGraphQLError(
            f"Saleor API returned a non-JSON response: {response.text[:500]}"
        ) from exc

    return body
