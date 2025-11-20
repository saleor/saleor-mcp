from typing import Annotated, Any, Optional

from fastmcp import Context, FastMCP

from ..ctx_utils import get_saleor_client
from ..saleor_client.base_model import BaseModel
from ..saleor_client.input_types import (
    DateRangeInput,
    DateTimeRangeInput,
    UserSortingInput,
)
from ..telemetry import instrument, Kind

customers_router = FastMCP("Customers MCP")


class CustomerFilterInput(BaseModel):
    dateJoined: Optional["DateRangeInput"] = None
    updatedAt: Optional["DateTimeRangeInput"] = None


@customers_router.tool(
    annotations={
        "title": "Fetch customers",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
@instrument(Kind.TOOL)
async def customers(
    ctx: Context,
    first: Annotated[
        int | None, "Number of customers to fetch (max 100 per request)"
    ] = 100,
    after: Annotated[
        str | None, "Cursor for pagination - fetch customers after this cursor"
    ] = None,
    sort_by: Annotated[
        UserSortingInput | None, "Sort customers by specific field"
    ] = None,
    filter: Annotated[
        CustomerFilterInput | None, "Filter customers by specific criteria"
    ] = None,
) -> dict[str, Any]:
    """Fetch list of customers from Saleor GraphQL API.

    This tool retrieves customer information such as: ID, active status, language code,
    last login, date joined, and default shipping/billing address country.

    """

    filter = filter.model_dump(exclude_unset=True) if filter else None
    sort_by = sort_by.model_dump(exclude_unset=True) if sort_by else None

    data = {}
    client = get_saleor_client()
    try:
        data = await client.list_customers(
            first=first,
            after=after,
            sortBy=sort_by,
            filter=filter,
        )
    except Exception as e:
        error_msg = str(e)
        if response := getattr(e, "response", None):
            error_msg = response.json()["errors"][0]["message"]
            error_msg += f" ({e.response.status_code})"
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
