from typing import Annotated, Any

from fastmcp import FastMCP

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


@orders_router.tool()
async def orders(
    first: Annotated[
        int | None, "Number of orders to fetch (max 100 per request)"
    ] = 100,
    after: Annotated[
        str | None, "Cursor for pagination - fetch orders after this cursor"
    ] = None,
) -> dict[str, Any]:
    """Fetch comprehensive order data from Saleor GraphQL API.

    This tool retrieves detailed order information including customer data,
    product details, payment information, shipping details, and order totals.
    """

    data = {}
    try:
        data = await make_saleor_request(
            query=ORDERS_LIST_QUERY,
            variables={"first": first, "after": after},
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
