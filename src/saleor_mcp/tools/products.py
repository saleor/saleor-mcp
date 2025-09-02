from typing import Annotated, Any

from fastmcp import Context, FastMCP
from fastmcp.exceptions import ToolError

from ..saleor_client import make_saleor_request

products_router = FastMCP("Products MCP")

PRODUCT_LIST_QUERY = """
query GetProducts($first: Int, $after: String, $channel: String, $where: ProductWhereInput, $sortBy: ProductOrder, $search: String) {
  products(
    first: $first
    after: $after
    channel: $channel
    where: $where
    sortBy: $sortBy
    search: $search
  ) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    edges {
      node {
        id
        name
        slug
        externalReference
        productType {
          id
          name
        }
        category {
          id
          name
        }
        created
        updatedAt
        pricing {
          priceRange {
            start {
              gross {
                currency
                amount
              }
            }
            stop {
              gross {
                currency
                amount
              }
            }
          }
        }
      }
    }
  }
}
"""


@products_router.tool()
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
    where: Annotated[dict | None, "Filter products by specific criteria"] = None,
    sortBy: Annotated[str | None, "Sort products by specific field"] = None,
    search: Annotated[str | None, "Search products with full-text search"] = None,
) -> dict[str, Any]:
    """Fetch list of products from Saleor GraphQL API.

    This tool retrieves product information such as: ID, name, slug, externalReference,
    productType, category, date of creation and update and pricing.

    Products are channel-aware, meaning that their availability and pricing can vary
    based on the specified channel. If a channel is provided, the tool will fetch
    product data specific to that channel. Otherwise, it will return general product
    data.

    The tool supports pagination with `first` and `after` parameters.

    """

    data = {}
    try:
        data = await make_saleor_request(
            query=PRODUCT_LIST_QUERY,
            variables={
                "first": first,
                "after": after,
                "channel": channel,
                "where": where,
                "sortBy": sortBy,
                "search": search,
            },
        )
    except ToolError as e:
        await ctx.error(str(e))
        raise

    products_data = data.get("products", [])
    return {
        "data": {
            "products": products_data.get("edges", []),
            "pageInfo": products_data.get("pageInfo", {}),
            "totalFetched": len(products_data.get("edges", [])),
        },
    }
