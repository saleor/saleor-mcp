from typing import Annotated, Any

from fastmcp import Context, FastMCP

from ..ctx_utils import get_saleor_client
from ..saleor_client.input_types import OrderSortingInput, OrderWhereInput

orders_router = FastMCP("Orders MCP")


@orders_router.tool(
    annotations={
        "title": "Fetch orders",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def orders(
    ctx: Context,
    first: Annotated[
        int | None, "Number of orders to fetch (max 100 per request)"
    ] = 100,
    after: Annotated[
        str | None, "Cursor for pagination - fetch orders after this cursor"
    ] = None,
    sort_by: Annotated[
        OrderSortingInput | None, "Sort orders by specific field"
    ] = None,
    where: Annotated[
        OrderWhereInput | None, "Filter orders by specific criteria"
    ] = None,
) -> dict[str, Any]:
    """Fetch list of orders from Saleor GraphQL API.

    This tool retrieves the list of orders. For each order it returns information such
    as: ID, number, status, creation date, last update date, payment status, user email,
    total amount, shipping address, billing address, order lines which include:
    quantity, product SKU, variant name, product ID, product name, unit price.

    Args:
        ctx (Context): The tool execution context.
        first (int | None): Number of orders to fetch (max 100 per request).
        after (str | None): Cursor for pagination - fetch orders after this cursor.
        sort_by (OrderSortingInput | None): Sort orders by specific field.
        where (OrderWhereInput | None): Filter orders by specific criteria.

    """

    sort_by = sort_by.model_dump(exclude_unset=True) if sort_by else None
    where = where.model_dump(exclude_unset=True) if where else None

    data = {}
    client = get_saleor_client()
    try:
        data = await client.list_orders(
            first=first, after=after, sortBy=sort_by, where=where
        )
    except Exception as e:
        await ctx.error(str(e))
        raise

    orders_data = data.orders
    edges = orders_data.edges if orders_data and orders_data.edges else []
    page_info = orders_data.pageInfo if orders_data else None

    return {
        "data": {
            "orders": edges,
            "pageInfo": page_info,
            "totalFetched": len(edges),
        },
    }


@orders_router.tool(
    annotations={
        "title": "Fetch orders count",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def order_count(
    ctx: Context,
    where: Annotated[
        OrderWhereInput | None, "Filter orders by specific criteria"
    ] = None,
) -> dict[str, Any]:
    """Fetch total count of orders from Saleor GraphQL API.

    This tool retrieves the total count of orders based on the provided filter criteria.

    Args:
        ctx (Context): The tool execution context.
        where (OrderWhereInput | None): Filter orders by specific criteria.

    """

    where = where.model_dump(exclude_unset=True) if where else None

    data = {}
    client = get_saleor_client()
    try:
        data = await client.count_orders(where=where)
    except Exception as e:
        await ctx.error(str(e))
        raise

    return {
        "data": {"totalCount": data.orders.totalCount if data and data.orders else 0}
    }
