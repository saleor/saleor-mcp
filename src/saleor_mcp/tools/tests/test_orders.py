from unittest.mock import patch

import pytest

from saleor_mcp.saleor_client import SaleorRequestError
from saleor_mcp.tools.orders import orders


@pytest.mark.asyncio
async def test_successful_orders_fetch(sample_orders_response):
    with patch("saleor_mcp.tools.orders.make_saleor_request") as mock_make_request:
        mock_make_request.return_value = sample_orders_response

        tool_result = await orders.run({"first": 10, "after": "cursor123"})
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


@pytest.mark.asyncio
async def test_orders_fetch_with_saleor_error():
    with patch("saleor_mcp.tools.orders.make_saleor_request") as mock_make_request:
        mock_make_request.side_effect = SaleorRequestError(
            "Invalid token", "INVALID_TOKEN"
        )

        tool_result = await orders.run({})
        result = tool_result.structured_content

        assert result["success"] is False
        assert result["error"] == "Invalid token"
        assert result["code"] == "INVALID_TOKEN"
        assert result["data"] == {}
