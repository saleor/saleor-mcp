from typing import Annotated, Any

from fastmcp import Context, FastMCP
from fastmcp.exceptions import ToolError

from ..saleor_client import make_saleor_request

orders_router = FastMCP("Orders MCP")

ORDERS_LIST_QUERY = """
query GetOrders($first: Int, $after: String, $sortBy: OrderSortingInput, $where: OrderWhereInput) {
  orders(first: $first, after: $after, sortBy: $sortBy, where: $where) {
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
    ctx: Context,
    first: Annotated[
        int | None, "Number of orders to fetch (max 100 per request)"
    ] = 100,
    after: Annotated[
        str | None, "Cursor for pagination - fetch orders after this cursor"
    ] = None,
    sortBy: Annotated[str | None, "Sort orders by specific field"] = None,
    where: Annotated[dict | None, "Filter orders by specific criteria"] = None,
) -> dict[str, Any]:
    """Fetch list of orders from Saleor GraphQL API.

    This tool retrieves basic order information including order ID, number, status,
    created and updated timestamps, payment status, total amount. Usage guidelines:
    - Use `first` and `after` parameters for pagination (max 100 orders per request);
    - Use `sortBy` to sort orders by fields: number, createdAt, lastModifiedAt, customer,
    payment status, status;
    - Use `where` to filter orders by criteria: IDs, number, channel, creation date,
    update date, user, status, payment status. Note: date filtering supports ranges.
    """

    data = {}
    try:
        data = await make_saleor_request(
            query=ORDERS_LIST_QUERY,
            variables={
                "first": first,
                "after": after,
                "sortBy": sortBy,
                "where": where,
            },
        )
    except ToolError as e:
        await ctx.error(str(e))
        raise

    orders_data = data.get("orders", [])
    return {
        "data": {
            "orders": orders_data.get("edges", []),
            "pageInfo": orders_data.get("pageInfo", {}),
            "totalFetched": len(orders_data.get("edges", [])),
        },
    }
