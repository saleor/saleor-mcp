from unittest.mock import patch

import pytest
from pydantic import ValidationError

from saleor_mcp.saleor_client import SaleorRequestError
from saleor_mcp.tools.orders import OrdersRequest, orders


def test_valid_orders_request_with_defaults():
    request = OrdersRequest(
        saleor_api_url="https://example.saleor.cloud/graphql/",
        authentication_token="test-token-123",
    )

    assert request.saleor_api_url == "https://example.saleor.cloud/graphql/"
    assert request.authentication_token == "test-token-123"
    assert request.first == 100
    assert request.after is None


def test_valid_orders_request_with_custom_values():
    request = OrdersRequest(
        saleor_api_url="https://example.saleor.cloud/graphql/",
        authentication_token="test-token-123",
        first=50,
        after="cursor123",
    )

    assert request.first == 50
    assert request.after == "cursor123"


def test_missing_required_fields():
    """Test OrdersRequest with missing required fields."""
    with pytest.raises(ValidationError) as exc_info:
        OrdersRequest(first=50)

    errors = exc_info.value.errors()
    assert len(errors) == 2
    error_fields = {error["loc"][0] for error in errors}
    assert "saleor_api_url" in error_fields
    assert "authentication_token" in error_fields


@pytest.mark.asyncio
async def test_successful_orders_fetch(sample_orders_response):
    mock_request = OrdersRequest(
        saleor_api_url="https://example.saleor.cloud/graphql/",
        authentication_token="test-token-123",
        first=10,
        after="cursor123",
    )

    with patch("saleor_mcp.tools.orders.make_saleor_request") as mock_make_request:
        mock_make_request.return_value = sample_orders_response

        tool_result = await orders.run({"request": mock_request})
        result = tool_result.structured_content

        assert result["success"] is True
        assert len(result["data"]["orders"]) == 1
        assert result["data"]["orders"][0]["node"]["number"] == "001"
        assert result["data"]["pageInfo"]["hasNextPage"] is True
        assert result["data"]["totalFetched"] == 1

        # Verify the request was made with correct parameters
        mock_make_request.assert_called_once()
        call_args = mock_make_request.call_args
        assert call_args[1]["variables"]["first"] == 10
        assert call_args[1]["variables"]["after"] == "cursor123"
        assert call_args[1]["authentication_token"] == "test-token-123"
        assert call_args[1]["saleor_api_url"] == "https://example.saleor.cloud/graphql/"


@pytest.mark.asyncio
async def test_orders_fetch_with_saleor_error():
    mock_request = OrdersRequest(
        saleor_api_url="https://example.saleor.cloud/graphql/",
        authentication_token="invalid-token",
    )

    with patch("saleor_mcp.tools.orders.make_saleor_request") as mock_make_request:
        mock_make_request.side_effect = SaleorRequestError(
            "Invalid token", "INVALID_TOKEN"
        )

        tool_result = await orders.run({"request": mock_request})
        result = tool_result.structured_content

        assert result["success"] is False
        assert result["error"] == "Invalid token"
        assert result["code"] == "INVALID_TOKEN"
        assert result["data"] == {}
