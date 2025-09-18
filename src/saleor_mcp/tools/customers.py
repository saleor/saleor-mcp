from typing import Annotated, Any, Optional

from fastmcp import Context, FastMCP

from ..ctx_utils import get_saleor_client
from ..saleor_client.base_model import BaseModel
from ..saleor_client.input_types import (
    DateTimeRangeInput,
    UserSortingInput,
)

customers_router = FastMCP("Customers MCP")


class CustomerWhereInput(BaseModel):
    dateJoined: Optional["DateTimeRangeInput"] = None
    updatedAt: Optional["DateTimeRangeInput"] = None


@customers_router.tool(
    annotations={
        "title": "Fetch customers",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def customers(
    ctx: Context,
    first: Annotated[
        int | None, "Number of customers to fetch (max 100 per request)"
    ] = 100,
    sortBy: Annotated[
        UserSortingInput | None, "Sort customers by specific field"
    ] = None,
    where: Annotated[
        CustomerWhereInput | None, "Filter customers by specific criteria"
    ] = None,
    search: Annotated[str | None, "Search customers with full-text search"] = None,
) -> dict[str, Any]:
    """Fetch list of customers from Saleor GraphQL API.

    This tool retrieves customer information such as: ID, email, first name, last name,
    active status, confirmation status, checkout and order counts, language code,
    last login, date joined, and default shipping/billing addresses.

    """

    where_data = where.model_dump(exclude_unset=True) if where else None
    sort_by = sortBy.model_dump(exclude_unset=True) if sortBy else None

    data = {}
    client = get_saleor_client()
    try:
        data = await client.list_customers(
            first=first,
            sortBy=sort_by,
            where=where_data,
            search=search,
        )
    except Exception as e:
        await ctx.error(str(e))
        raise

    customers_data = data.customers
    edges = customers_data.edges if customers_data and customers_data.edges else []
    page_info = customers_data.pageInfo if customers_data else None
    return {
        "data": {
            "customers": edges,
            "pageInfo": page_info,
            "totalFetched": len(edges),
        },
    }
