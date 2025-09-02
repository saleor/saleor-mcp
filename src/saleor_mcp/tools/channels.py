from typing import Any

from fastmcp import Context, FastMCP
from fastmcp.exceptions import ToolError

from ..saleor_client import make_saleor_request

channels_router = FastMCP("Channels MCP")

CHANNELS_LIST_QUERY = """
query GetChannels {
  channels {
    id
    slug
    name
    isActive
    currencyCode
    defaultCountry {
      code
    }
    warehouses {
      id
      name
    }
  }
}
"""


@channels_router.tool()
async def channels(ctx: Context) -> dict[str, Any]:
    """Fetch the list of channels from Saleor.

    For each channel fetches the following details: id, slug, name, isActive,
    currencyCode, defaultCountry (code), warehouses (id, name).
    """

    data = {}
    try:
        data = await make_saleor_request(
            query=CHANNELS_LIST_QUERY,
            variables={},
        )
    except Exception as e:
        raise ToolError(f"Failed to fetch channels: {str(e)}") from e

    channels_data = data.get("channels", [])
    return {
        "data": {
            "channels": channels_data,
            "totalFetched": len(channels_data),
        }
    }
