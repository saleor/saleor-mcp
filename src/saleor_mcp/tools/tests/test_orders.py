from unittest.mock import patch

import pytest
from fastmcp import Client as MCPClient
from fastmcp.exceptions import ToolError

from saleor_mcp.main import mcp
from saleor_mcp.saleor_client.client import Client as SaleorClient


@pytest.mark.asyncio
async def test_orders_no_parameters(sample_orders_response, mock_saleor_config):
    """Test orders fetch with no parameters (using defaults)."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_orders") as mock_list_orders,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_orders.return_value = sample_orders_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("orders", {})

        data = result.data["data"]
        assert len(data["orders"]) == 1
        assert data["pageInfo"]["hasNextPage"] is True
        assert data["totalFetched"] == 1

        # Verify the request was made with default parameters
        mock_list_orders.assert_called_once()
        call_args = mock_list_orders.call_args
        assert call_args[1]["first"] == 100  # default value
        assert call_args[1]["after"] is None
        assert call_args[1]["sortBy"] is None
        assert call_args[1]["filter"] is None


@pytest.mark.asyncio
async def test_orders_with_all_parameters(sample_orders_response, mock_saleor_config):
    """Test orders fetch with all parameters: pagination, sorting, and filters."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_orders") as mock_list_orders,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_orders.return_value = sample_orders_response

        async with MCPClient(mcp) as mcp_client:
            _ = await mcp_client.call_tool(
                "orders",
                {
                    "first": 50,
                    "after": "cursor456",
                    "sort_by": {"field": "CREATED_AT", "direction": "DESC"},
                    "filter": {
                        "search": "test",
                        "created": {
                            "gte": "2023-01-01T00:00:00Z",
                            "lte": "2023-12-31T23:59:59Z",
                        },
                        "updatedAt": {"gte": "2023-06-01T00:00:00Z"},
                    },
                },
            )

        # Verify all parameters were passed correctly
        mock_list_orders.assert_called_once()
        call_args = mock_list_orders.call_args
        assert call_args[1]["first"] == 50
        assert call_args[1]["after"] == "cursor456"
        assert call_args[1]["sortBy"] == {"field": "CREATED_AT", "direction": "DESC"}
        assert call_args[1]["filter"] == {
            "search": "test",
            "created": {
                "gte": "2023-01-01T00:00:00Z",
                "lte": "2023-12-31T23:59:59Z",
            },
            "updatedAt": {"gte": "2023-06-01T00:00:00Z"},
        }


@pytest.mark.asyncio
async def test_orders_empty_result(mock_saleor_config):
    """Test orders fetch with empty result."""
    from saleor_mcp.saleor_client.list_orders import ListOrders

    empty_response = ListOrders.model_validate(
        {
            "orders": {
                "edges": [],
                "totalCount": 0,
                "pageInfo": {
                    "hasNextPage": False,
                    "hasPreviousPage": False,
                    "startCursor": None,
                    "endCursor": None,
                },
            }
        }
    )

    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_orders") as mock_list_orders,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_orders.return_value = empty_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("orders", {})

        data = result.data["data"]
        assert len(data["orders"]) == 0
        assert data["totalFetched"] == 0
        assert data["pageInfo"]["hasNextPage"] is False


@pytest.mark.asyncio
async def test_orders_fetch_with_saleor_error(mock_saleor_config):
    """Test orders fetch error handling."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "list_orders") as mock_list_orders,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_list_orders.side_effect = Exception("Invalid token")

        async with MCPClient(mcp) as mcp_client:
            with pytest.raises(ToolError) as e:
                await mcp_client.call_tool("orders", {"first": 10})

        assert "Invalid token" in str(e.value)
        mock_list_orders.assert_called_once()


@pytest.mark.asyncio
async def test_order_count_no_parameters(
    sample_count_orders_response, mock_saleor_config
):
    """Test order count without parameters."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "count_orders") as mock_count_orders,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_count_orders.return_value = sample_count_orders_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool("order_count", {})

        data = result.data["data"]
        assert data["totalCount"] == 42

        # Verify the request was made with no filter
        mock_count_orders.assert_called_once()
        call_args = mock_count_orders.call_args
        assert call_args[1]["filter"] is None


@pytest.mark.asyncio
async def test_order_count_with_all_parameters(
    sample_count_orders_response, mock_saleor_config
):
    """Test order count with all parameters."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "count_orders") as mock_count_orders,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_count_orders.return_value = sample_count_orders_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool(
                "order_count",
                {
                    "filter": {
                        "search": "test",
                        "created": {"gte": "2023-01-01T00:00:00Z"},
                        "updatedAt": {"lte": "2023-12-31T23:59:59Z"},
                    }
                },
            )

        data = result.data["data"]
        assert data["totalCount"] == 42

        # Verify all filter parameters were passed correctly
        mock_count_orders.assert_called_once()
        call_args = mock_count_orders.call_args
        assert call_args[1]["filter"] == {
            "search": "test",
            "created": {"gte": "2023-01-01T00:00:00Z"},
            "updatedAt": {"lte": "2023-12-31T23:59:59Z"},
        }


@pytest.mark.asyncio
async def test_order_count_with_saleor_error(mock_saleor_config):
    """Test order count error handling."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "count_orders") as mock_count_orders,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_count_orders.side_effect = Exception("Database connection error")

        async with MCPClient(mcp) as mcp_client:
            with pytest.raises(ToolError) as e:
                await mcp_client.call_tool("order_count", {})

        assert "Database connection error" in str(e.value)
        mock_count_orders.assert_called_once()


@pytest.mark.asyncio
async def test_order_count_empty_result(
    empty_count_orders_response, mock_saleor_config
):
    """Test order count with zero results."""
    with (
        patch("saleor_mcp.ctx_utils.get_config_from_headers") as mock_get_config,
        patch.object(SaleorClient, "count_orders") as mock_count_orders,
    ):
        mock_get_config.return_value = mock_saleor_config
        mock_count_orders.return_value = empty_count_orders_response

        async with MCPClient(mcp) as mcp_client:
            result = await mcp_client.call_tool(
                "order_count", {"filter": {"search": "nonexistent"}}
            )

        data = result.data["data"]
        assert data["totalCount"] == 0
