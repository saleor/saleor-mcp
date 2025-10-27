from typing import Annotated, Any

from fastmcp import Context, FastMCP

from ..ctx_utils import get_saleor_client
from ..saleor_client.input_types import (
    ProductOrder,
    StockFilterInput,
)

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
    sort_by: Annotated[ProductOrder | None, "Sort products by specific field"] = None,
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

    sort_by = sort_by.model_dump(exclude_unset=True) if sort_by else None

    data = {}
    client = get_saleor_client()
    try:
        data = await client.list_products(
            first=first,
            after=after,
            channel=channel,
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


@products_router.tool(
    annotations={
        "title": "Fetch stocks",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def stocks(
    ctx: Context,
    first: Annotated[
        int | None, "Number of stocks to fetch (max 100 per request)"
    ] = 100,
    after: Annotated[
        str | None, "Cursor for pagination - fetch stocks after this cursor"
    ] = None,
    filter: Annotated[
        StockFilterInput | None, "Filter stocks by specific criteria"
    ] = None,
) -> dict[str, Any]:
    """Fetch list of stocks from Saleor GraphQL API.

    This tool retrieves stock information such as: ID, quantity, allocated quantity,
    warehouse information, and associated product variant details.

    """

    filter_data = filter.model_dump(exclude_unset=True) if filter else None

    data = {}
    client = get_saleor_client()
    try:
        data = await client.list_stocks(
            first=first,
            after=after,
            filter=filter_data,
        )
    except Exception as e:
        await ctx.error(str(e))
        raise

    stocks_data = data.stocks
    edges = stocks_data.edges if stocks_data and stocks_data.edges else []
    page_info = stocks_data.pageInfo if stocks_data else None
    return {
        "data": {
            "stocks": edges,
            "pageInfo": page_info,
            "totalFetched": len(edges),
        },
    }


@products_router.tool(
    annotations={
        "title": "Fetch warehouse details",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def warehouse_details(
    ctx: Context,
    id: Annotated[str | None, "ID of the warehouse to fetch details for"] = None,
) -> dict[str, Any]:
    """Fetch warehouse details from Saleor GraphQL API.

    This tool retrieves detailed warehouse information including: ID, name, slug,
    address details, click and collect options, associated shipping zones with
    their channels and countries, and metadata.

    """

    data = {}
    client = get_saleor_client()
    try:
        data = await client.warehouse_details(id=id)
    except Exception as e:
        await ctx.error(str(e))
        raise

    warehouse_data = data.warehouse
    return {
        "data": {
            "warehouse": warehouse_data,
        },
    }
