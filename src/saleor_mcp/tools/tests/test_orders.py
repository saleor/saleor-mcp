from unittest.mock import patch

import pytest

from saleor_mcp.saleor_client import SaleorRequestError
from saleor_mcp.tools.orders import orders


@pytest.mark.asyncio
async def test_successful_orders_fetch(sample_orders_response, context):
    with (
        context,
        patch("saleor_mcp.tools.orders.make_saleor_request") as mock_make_request,
    ):
        mock_make_request.return_value = sample_orders_response

        tool_result = await orders.run({"first": 10, "after": "cursor123"})
        result = tool_result.structured_content

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
async def test_orders_fetch_with_saleor_error(context):
    with (
        context,
        patch("saleor_mcp.tools.orders.make_saleor_request") as mock_make_request,
        patch("saleor_mcp.tools.orders.Context.error") as mock_ctx_error,
    ):
        mock_make_request.side_effect = SaleorRequestError(
            "Invalid token", "INVALID_TOKEN"
        )

        with pytest.raises(SaleorRequestError) as e:
            await orders.run({})

        assert e.value.message == "Invalid token"
        assert e.value.code == "INVALID_TOKEN"
        mock_ctx_error.assert_awaited_once_with("Invalid token")
