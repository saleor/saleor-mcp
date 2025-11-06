from unittest.mock import patch

import pytest
from fastmcp import Client as MCPClient
from fastmcp.exceptions import ToolError

from saleor_mcp.main import mcp
from saleor_mcp.saleor_client.client import Client as SaleorClient


@pytest.mark.asyncio
async def test_customers_no_parameters(sample_customers_response, mock_saleor_config):
    """Test basic customers fetch without parameters."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_customers") as mock_list_customers,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_customers.return_value = sample_customers_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("customers", {})

        data = result.data["data"]
        assert len(data["customers"]) == 3
        assert data["pageInfo"]["hasNextPage"] is True
        assert data["totalFetched"] == 3

        # Verify the request was made with default parameters
        mock_list_customers.assert_called_once()
        call_args = mock_list_customers.call_args
        assert call_args[1]["first"] == 100  # default value
        assert call_args[1]["after"] is None
        assert call_args[1]["sortBy"] is None
        assert call_args[1]["filter"] is None


@pytest.mark.asyncio
async def test_customers_with_all_parameters(
    sample_customers_response, mock_saleor_config
):
    """Test customers fetch with all parameters: pagination, sorting, and filters."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_customers") as mock_list_customers,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_customers.return_value = sample_customers_response

        async with MCPClient(mcp) as mcp_client:
            _ = await mcp_client.call_tool(
                "customers",
                {
                    "first": 50,
                    "after": "cursor456",
                    "sort_by": {"field": "CREATED_AT", "direction": "DESC"},
                    "filter": {
                        "dateJoined": {
                            "gte": "2023-01-01T00:00:00Z",
                            "lte": "2023-12-31T23:59:59Z",
                        },
                        "updatedAt": {"gte": "2023-06-01T00:00:00Z"},
                    },
                },
            )

        # Verify all parameters were passed correctly
        mock_list_customers.assert_called_once()
        call_args = mock_list_customers.call_args
        assert call_args[1]["first"] == 50
        assert call_args[1]["after"] == "cursor456"
        assert call_args[1]["sortBy"] == {"field": "CREATED_AT", "direction": "DESC"}
        assert call_args[1]["filter"] == {
            "dateJoined": {
                "gte": "2023-01-01T00:00:00Z",
                "lte": "2023-12-31T23:59:59Z",
            },
            "updatedAt": {"gte": "2023-06-01T00:00:00Z"},
        }


@pytest.mark.asyncio
async def test_customers_empty_response(empty_customers_response, mock_saleor_config):
    """Test customers fetch with empty response."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_customers") as mock_list_customers,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_customers.return_value = empty_customers_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("customers", {})

        data = result.data["data"]
        assert len(data["customers"]) == 0
        assert data["totalFetched"] == 0


@pytest.mark.asyncio
async def test_customers_fetch_with_saleor_error(mock_saleor_config):
    """Test customers fetch error handling."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_customers") as mock_list_customers,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_customers.side_effect = Exception("Invalid token")

        async with MCPClient(mcp) as mcp_client:
            with pytest.raises(ToolError) as e:
                await mcp_client.call_tool("customers", {"first": 10})

        assert "Invalid token" in str(e.value)
        mock_list_customers.assert_called_once()
