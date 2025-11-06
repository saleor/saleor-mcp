from unittest.mock import patch

import pytest
from fastmcp import Client as MCPClient
from fastmcp.exceptions import ToolError

from saleor_mcp.main import mcp
from saleor_mcp.saleor_client.client import Client as SaleorClient


@pytest.mark.asyncio
async def test_channels_successful_fetch(sample_channels_response, mock_saleor_config):
    """Test successful channels fetch with multiple channels."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_channels") as mock_list_channels,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_channels.return_value = sample_channels_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("channels", {})

        data = result.data["data"]
        assert len(data["channels"]) == 3
        assert len(data["channels"]) == data["totalFetched"]

        # Verify the request was made
        mock_list_channels.assert_called_once()
        assert mock_list_channels.call_args.args == ()
        assert mock_list_channels.call_args.kwargs == {}


@pytest.mark.asyncio
async def test_channels_empty_result(empty_channels_response, mock_saleor_config):
    """Test channels fetch with empty result."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_channels") as mock_list_channels,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_channels.return_value = empty_channels_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("channels", {})

        data = result.data["data"]
        assert len(data["channels"]) == 0
        assert data["totalFetched"] == 0


@pytest.mark.asyncio
async def test_channels_with_saleor_error(mock_saleor_config):
    """Test channels fetch error handling."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_channels") as mock_list_channels,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_channels.side_effect = Exception("GraphQL API error")

        async with MCPClient(mcp) as mcp_client:
            with pytest.raises(ToolError) as e:
                await mcp_client.call_tool("channels", {})

        assert "GraphQL API error" in str(e.value)
        mock_list_channels.assert_called_once()
