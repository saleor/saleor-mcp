import pytest

from saleor_mcp.config import SaleorConfig


@pytest.fixture
def mock_saleor_config():
    return SaleorConfig(
        api_url="https://example.com/graphql/", auth_token="test-token"
    )


@pytest.fixture(autouse=True)
def _clear_schema_cache():
    """Ensure the introspection cache never leaks between tests."""
    from saleor_mcp import introspection

    introspection._schema_cache.clear()
    yield
    introspection._schema_cache.clear()
