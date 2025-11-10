from unittest.mock import patch

import pytest
from fastmcp import Client as MCPClient
from fastmcp.exceptions import ToolError

from saleor_mcp.main import mcp
from saleor_mcp.saleor_client.client import Client as SaleorClient


@pytest.mark.asyncio
async def test_products_no_parameters(sample_products_response, mock_saleor_config):
    """Test products fetch with no parameters (using defaults)."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_products") as mock_list_products,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_products.return_value = sample_products_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("products", {})

        data = result.data["data"]
        assert len(data["products"]) == 2
        assert data["pageInfo"]["hasNextPage"] is True
        assert data["totalFetched"] == 2

        # Verify the request was made with default parameters
        mock_list_products.assert_called_once()
        call_args = mock_list_products.call_args
        assert call_args[1]["first"] == 100  # default value
        assert call_args[1]["after"] is None
        assert call_args[1]["channel"] is None
        assert call_args[1]["sortBy"] is None
        assert call_args[1]["search"] is None


@pytest.mark.asyncio
async def test_products_with_all_parameters(
    sample_products_response, mock_saleor_config
):
    """Test products fetch with all parameters: pagination, channel, sorting, and search."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_products") as mock_list_products,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_products.return_value = sample_products_response

        async with MCPClient(mcp) as mcp_client:
            _ = await mcp_client.call_tool(
                "products",
                {
                    "first": 25,
                    "after": "cursor123",
                    "channel": "default-channel",
                    "sort_by": {"field": "NAME", "direction": "ASC"},
                    "search": "hoodie",
                },
            )

        # Verify all parameters were passed correctly
        mock_list_products.assert_called_once()
        call_args = mock_list_products.call_args
        assert call_args[1]["first"] == 25
        assert call_args[1]["after"] == "cursor123"
        assert call_args[1]["channel"] == "default-channel"
        assert call_args[1]["sortBy"] == {"field": "NAME", "direction": "ASC"}
        assert call_args[1]["search"] == "hoodie"


@pytest.mark.asyncio
async def test_products_empty_result(empty_products_response, mock_saleor_config):
    """Test products fetch with empty result."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_products") as mock_list_products,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_products.return_value = empty_products_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("products", {})

        data = result.data["data"]
        assert len(data["products"]) == 0
        assert data["totalFetched"] == 0
        assert data["pageInfo"]["hasNextPage"] is False


@pytest.mark.asyncio
async def test_products_fetch_with_saleor_error(mock_saleor_config):
    """Test products fetch error handling."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_products") as mock_list_products,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_products.side_effect = Exception("GraphQL error")

        async with MCPClient(mcp) as mcp_client:
            with pytest.raises(ToolError) as e:
                await mcp_client.call_tool("products", {"first": 10})

        assert "GraphQL error" in str(e.value)
        mock_list_products.assert_called_once()


@pytest.mark.asyncio
async def test_stocks_no_parameters(sample_stocks_response, mock_saleor_config):
    """Test stocks fetch with no parameters (using defaults)."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_stocks") as mock_list_stocks,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_stocks.return_value = sample_stocks_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("stocks", {})

        data = result.data["data"]
        assert len(data["stocks"]) == 2
        assert data["pageInfo"]["hasNextPage"] is False
        assert data["totalFetched"] == 2

        # Verify the request was made with default parameters
        mock_list_stocks.assert_called_once()
        call_args = mock_list_stocks.call_args
        assert call_args[1]["first"] == 100  # default value
        assert call_args[1]["after"] is None
        assert call_args[1]["filter"] is None


@pytest.mark.asyncio
async def test_stocks_with_all_parameters(sample_stocks_response, mock_saleor_config):
    """Test stocks fetch with all parameters: pagination and filter."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_stocks") as mock_list_stocks,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_stocks.return_value = sample_stocks_response

        async with MCPClient(mcp) as mcp_client:
            _ = await mcp_client.call_tool(
                "stocks",
                {
                    "first": 50,
                    "after": "cursor456",
                    "filter": {"quantity": 100.0, "search": "hoodie"},
                },
            )

        # Verify all parameters were passed correctly
        mock_list_stocks.assert_called_once()
        call_args = mock_list_stocks.call_args
        assert call_args[1]["first"] == 50
        assert call_args[1]["after"] == "cursor456"
        assert call_args[1]["filter"] == {"quantity": 100.0, "search": "hoodie"}


@pytest.mark.asyncio
async def test_stocks_empty_result(empty_stocks_response, mock_saleor_config):
    """Test stocks fetch with empty result."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_stocks") as mock_list_stocks,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_stocks.return_value = empty_stocks_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("stocks", {})

        data = result.data["data"]
        assert len(data["stocks"]) == 0
        assert data["totalFetched"] == 0
        assert data["pageInfo"]["hasNextPage"] is False


@pytest.mark.asyncio
async def test_stocks_fetch_with_saleor_error(mock_saleor_config):
    """Test stocks fetch error handling."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_stocks") as mock_list_stocks,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_stocks.side_effect = Exception("Database connection error")

        async with MCPClient(mcp) as mcp_client:
            with pytest.raises(ToolError) as e:
                await mcp_client.call_tool("stocks", {})

        assert "Database connection error" in str(e.value)
        mock_list_stocks.assert_called_once()


@pytest.mark.asyncio
async def test_warehouse_details_with_id(sample_warehouse_response, mock_saleor_config):
    """Test warehouse details fetch with warehouse ID."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "warehouse_details") as mock_warehouse_details,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_warehouse_details.return_value = sample_warehouse_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool(
                "warehouse_details", {"id": "V2FyZWhvdXNlOjE="}
            )

        data = result.data["data"]
        assert data["warehouse"] is not None
        assert data["warehouse"]["id"] == "V2FyZWhvdXNlOjE="
        assert data["warehouse"]["name"] == "US East Warehouse"
        assert data["warehouse"]["slug"] == "us-east"

        # Verify the request was made with the ID
        mock_warehouse_details.assert_called_once()
        call_args = mock_warehouse_details.call_args
        assert call_args[1]["id"] == "V2FyZWhvdXNlOjE="


@pytest.mark.asyncio
async def test_warehouse_details_no_id(sample_warehouse_response, mock_saleor_config):
    """Test warehouse details fetch with no ID (None)."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "warehouse_details") as mock_warehouse_details,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_warehouse_details.return_value = sample_warehouse_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("warehouse_details", {})

        data = result.data["data"]
        assert data["warehouse"] is not None

        # Verify the request was made with no ID
        mock_warehouse_details.assert_called_once()
        call_args = mock_warehouse_details.call_args
        assert call_args[1]["id"] is None


@pytest.mark.asyncio
async def test_warehouse_details_not_found(
    empty_warehouse_response, mock_saleor_config
):
    """Test warehouse details fetch when warehouse is not found (empty result)."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "warehouse_details") as mock_warehouse_details,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_warehouse_details.return_value = empty_warehouse_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool(
                "warehouse_details", {"id": "INVALID_ID"}
            )

        data = result.data["data"]
        assert data["warehouse"] is None


@pytest.mark.asyncio
async def test_warehouse_details_with_saleor_error(mock_saleor_config):
    """Test warehouse details fetch error handling."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "warehouse_details") as mock_warehouse_details,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_warehouse_details.side_effect = Exception("Invalid warehouse ID")

        async with MCPClient(mcp) as mcp_client:
            with pytest.raises(ToolError) as e:
                await mcp_client.call_tool(
                    "warehouse_details", {"id": "V2FyZWhvdXNlOjk5OQ=="}
                )

        assert "Invalid warehouse ID" in str(e.value)
        mock_warehouse_details.assert_called_once()
