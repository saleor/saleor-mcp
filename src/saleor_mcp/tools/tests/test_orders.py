from unittest.mock import patch

import pytest
from fastmcp import Client as MCPClient
from fastmcp.exceptions import ToolError

from saleor_mcp.main import mcp
from saleor_mcp.saleor_client.client import Client as SaleorClient


@pytest.mark.asyncio
async def test_successful_orders_fetch(sample_orders_response, mock_saleor_config):
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_orders") as mock_list_orders_request,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_orders_request.return_value = sample_orders_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool(
                "orders", {"first": 10, "after": "cursor123"}
            )

        data = result.data["data"]
        assert len(data["orders"]) == 1
        assert data["orders"][0]["node"]["number"] == "001"
        assert data["pageInfo"]["hasNextPage"] is True
        assert data["totalFetched"] == 1

        # Verify the request was made with correct parameters
        mock_list_orders_request.assert_called_once()
        call_args = mock_list_orders_request.call_args
        assert call_args[1]["first"] == 10
        assert call_args[1]["after"] == "cursor123"


@pytest.mark.asyncio
async def test_orders_fetch_with_saleor_error(mock_saleor_config):
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_orders") as mock_list_orders_request,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_orders_request.side_effect = Exception("Invalid token")

        async with MCPClient(mcp) as mcp_client:
            with pytest.raises(ToolError) as e:
                await mcp_client.call_tool("orders", {"first": 10})

        assert "Invalid token" in str(e.value)

        # Verify the request was attempted
        mock_list_orders_request.assert_called_once()
