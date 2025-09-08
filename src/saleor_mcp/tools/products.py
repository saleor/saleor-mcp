from typing import Annotated, Any

from fastmcp import Context, FastMCP

from ..ctx_utils import get_saleor_client
from ..saleor_client.input_types import ProductOrder, ProductWhereInput

products_router = FastMCP("Products MCP")


@products_router.tool(
    annotations={
        "title": "Fetch products",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def products(
    ctx: Context,
    first: Annotated[
        int | None, "Number of products to fetch (max 100 per request)"
    ] = 100,
    after: Annotated[
        str | None, "Cursor for pagination - fetch products after this cursor"
    ] = None,
    channel: Annotated[
        str | None,
        "Slug of a channel for which the data should be returned. If not provided, "
        "general product data is returned.",
    ] = None,
    where: Annotated[
        ProductWhereInput | None, "Filter products by specific criteria"
    ] = None,
    sortBy: Annotated[ProductOrder | None, "Sort products by specific field"] = None,
    search: Annotated[str | None, "Search products with full-text search"] = None,
) -> dict[str, Any]:
    """Fetch list of products from Saleor GraphQL API.

    This tool retrieves product information such as: ID, name, slug, external reference,
    product type, category, date of creation, date of last update, and pricing.

    Products are channel-aware, meaning that their availability and pricing can vary
    based on the specified channel. If a channel is provided, the tool will fetch
    product data specific to that channel. Otherwise, it will return general product
    data.

    """

    where = where.model_dump(exclude_unset=True) if where else None
    sort_by = sortBy.model_dump(exclude_unset=True) if sortBy else None

    data = {}
    client = get_saleor_client()
    try:
        data = await client.list_products(
            first=first,
            after=after,
            channel=channel,
            where=where,
            sortBy=sort_by,
            search=search,
        )
    except Exception as e:
        await ctx.error(str(e))
        raise

    products_data = data.products
    edges = products_data.edges if products_data and products_data.edges else []
    page_info = products_data.pageInfo if products_data else None
    return {
        "data": {
            "products": edges,
            "pageInfo": page_info,
            "totalFetched": len(edges),
        },
    }
