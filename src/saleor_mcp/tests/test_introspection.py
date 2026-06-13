from unittest.mock import AsyncMock, patch

import pytest

from saleor_mcp import introspection
from saleor_mcp.config import SaleorConfig
from saleor_mcp.gql_client import SaleorGraphQLError


def _config(url: str) -> SaleorConfig:
    return SaleorConfig(api_url=url, auth_token="tok")


def _introspection_body() -> dict:
    # Reuse the bundled schema to produce a realistic introspection payload.
    from graphql import get_introspection_query, graphql_sync

    schema = introspection._load_bundled_schema()
    result = graphql_sync(schema, get_introspection_query(descriptions=True))
    return {"data": result.data}


@pytest.mark.asyncio
async def test_schema_cache_is_bounded(monkeypatch):
    monkeypatch.setattr(introspection, "_SCHEMA_CACHE_MAXSIZE", 3)
    body = _introspection_body()

    with patch(
        "saleor_mcp.introspection.execute_graphql",
        new=AsyncMock(return_value=body),
    ):
        for i in range(10):
            await introspection.get_schema(_config(f"https://shop{i}.saleor.cloud/"))

    # The cache never grows past the bound, even with many distinct API URLs.
    assert len(introspection._schema_cache) == 3


@pytest.mark.asyncio
async def test_fallback_schema_is_not_cached_per_url():
    # A failed live introspection falls back to the bundled schema but must NOT pin
    # it to the API URL, so a later successful introspection still gets cached.
    with patch(
        "saleor_mcp.introspection.execute_graphql",
        new=AsyncMock(side_effect=SaleorGraphQLError("boom")),
    ):
        schema = await introspection.get_schema(_config("https://shop.saleor.cloud/"))

    assert schema is not None
    assert "https://shop.saleor.cloud/" not in introspection._schema_cache
