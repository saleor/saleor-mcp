from typing import Any

from fastmcp import Context, FastMCP

from ..ctx_utils import get_saleor_client

channels_router = FastMCP("Channels MCP")


@channels_router.tool(
    annotations={
        "title": "Fetch channels",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def channels(ctx: Context) -> dict[str, Any]:
    """Fetch the list of channels from Saleor.

    This tools retrieves the list of channels. For each channel it returns information
    such as: ID, name, slug, currency code, default country, whether the channel is
    active, and the list of warehouses.
    """

    data = {}
    client = get_saleor_client()
    try:
        data = await client.list_channels()
    except Exception as e:
        await ctx.error(str(e))
        raise

    channels_data = data.channels or []
    return {
        "data": {
            "channels": channels_data,
            "totalFetched": len(channels_data),
        }
    }
