from typing import Any

from fastmcp import FastMCP
from pydantic import Field

from ..models import SaleorRequest
from ..saleor_client import SaleorRequestError, make_saleor_request

orders_router = FastMCP("Orders MCP")

ORDERS_LIST_QUERY = """
query GetOrders($first: Int, $after: String) {
  orders(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    edges {
      node {
        id
        number
        status
        created
        updatedAt
        paymentStatus
        total {
          gross {
            amount
            currency
          }
        }
      }
    }
  }
}
"""


class OrdersRequest(SaleorRequest):
    """Request model for the orders tool."""

    first: int | None = Field(
        default=100, description="Number of orders to fetch (max 100 per request)"
    )
    after: str | None = Field(
        default=None,
        description="Cursor for pagination - fetch orders after this cursor",
    )


@orders_router.tool()
async def orders(request: OrdersRequest) -> dict[str, Any]:
    """Fetch comprehensive order data from Saleor GraphQL API.

    This tool retrieves detailed order information including customer data,
    product details, payment information, shipping details, and order totals.
    """

    data = {}
    try:
        data = await make_saleor_request(
            query=ORDERS_LIST_QUERY,
            variables={"first": request.first, "after": request.after},
            authentication_token=request.authentication_token,
            saleor_api_url=request.saleor_api_url,
        )
    except SaleorRequestError as e:
        return {
            "success": False,
            "error": e.message,
            "code": e.code,
            "data": {},
        }

    orders_data = data.get("orders", {})
    return {
        "success": True,
        "data": {
            "orders": orders_data.get("edges", []),
            "pageInfo": orders_data.get("pageInfo", {}),
            "totalFetched": len(orders_data.get("edges", [])),
        },
    }
