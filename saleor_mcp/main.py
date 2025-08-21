from typing import Any

import httpx
from fastmcp import FastMCP
from pydantic import BaseModel, Field

ORDERS_QUERY = """
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
        statusDisplay
        paymentStatus
        paymentStatusDisplay
        total {
          gross {
            amount
            currency
          }
          net {
            amount
            currency
          }
          tax {
            amount
            currency
          }
        }
        subtotal {
          gross {
            amount
            currency
          }
          net {
            amount
            currency
          }
        }
        shippingPrice {
          gross {
            amount
            currency
          }
          net {
            amount
            currency
          }
        }
        user {
          id
          email
          firstName
          lastName
        }
        billingAddress {
          firstName
          lastName
          companyName
          streetAddress1
          streetAddress2
          city
          cityArea
          postalCode
          country {
            code
            country
          }
          countryArea
          phone
        }
        shippingAddress {
          firstName
          lastName
          companyName
          streetAddress1
          streetAddress2
          city
          cityArea
          postalCode
          country {
            code
            country
          }
          countryArea
          phone
        }
        deliveryMethod {
          ... on ShippingMethod {
            id
            name
          }
          ... on Warehouse {
            id
            name
            slug
          }
        }
        channel {
          id
          name
          slug
          currencyCode
        }
        lines {
          id
          productName
          productSku
          quantity
          unitPrice {
            gross {
              amount
              currency
            }
            net {
              amount
              currency
            }
          }
          totalPrice {
            gross {
              amount
              currency
            }
            net {
              amount
              currency
            }
          }
          variant {
            id
            name
            sku
            product {
              id
              name
              slug
              category {
                id
                name
                slug
              }
            }
          }
        }
        payments {
          id
          gateway
          isActive
          created
          modified
          chargeStatus
          capturedAmount {
            amount
            currency
          }
          total {
            amount
            currency
          }
        }
        fulfillments {
          id
          status
          trackingNumber
          created
          lines {
            id
            quantity
            orderLine {
              id
              productName
              productSku
              quantity
            }
          }
        }
        discounts {
          id
          type
          name
          total {
            amount
            currency
          }
        }
        voucher {
          id
          code
          name
          discountValueType
        }
        weight {
          unit
          value
        }
        privateMetadata {
          key
          value
        }
        metadata {
          key
          value
        }
        events {
          id
          type
          date
          user {
            id
            email
          }
          message
        }
      }
    }
  }
}
"""



class OrdersRequest(BaseModel):
    """Request model for the orders tool."""

    saleor_api_url: str = Field(
        description="The URL of the Saleor GraphQL API (e.g., 'https://your-saleor-instance.com/graphql/')"
    )
    authentication_token: str = Field(
        description="Valid authentication token for the Saleor GraphQL API"
    )
    first: int | None = Field(
        default=100, description="Number of orders to fetch (max 100 per request)"
    )
    after: str | None = Field(
        default=None,
        description="Cursor for pagination - fetch orders after this cursor",
    )


# Create MCP server instance
mcp = FastMCP("Saleor MCP Server")


@mcp.tool()
async def orders(request: OrdersRequest) -> dict[str, Any]:
    """Fetch comprehensive order data from Saleor GraphQL API.

    This tool retrieves detailed order information including customer data,
    product details, payment information, shipping details, and order totals.
    """

    try:
        # Prepare GraphQL request
        variables = {"first": request.first, "after": request.after}
        payload = {"query": ORDERS_QUERY, "variables": variables}
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {request.authentication_token}",
        }

        # Make GraphQL request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                request.saleor_api_url,
                json=payload,
                headers=headers,
                timeout=30.0,
            )

            response.raise_for_status()
            data = response.json()

            if "errors" in data:
                return {
                    "success": False,
                    "errors": data["errors"],
                    "message": "GraphQL query returned errors",
                }

            orders_data = data.get("data", {}).get("orders", {})

            return {
                "success": True,
                "data": {
                    "orders": orders_data.get("edges", []),
                    "pageInfo": orders_data.get("pageInfo", {}),
                    "totalFetched": len(orders_data.get("edges", [])),
                    "hasNextPage": orders_data.get("pageInfo", {}).get(
                        "hasNextPage", False
                    ),
                    "endCursor": orders_data.get("pageInfo", {}).get("endCursor"),
                },
                "message": (
                    f"Successfully fetched {len(orders_data.get('edges', []))} orders"
                ),
            }

    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "error": f"HTTP error {e.response.status_code}: {e.response.text}",
            "message": "Failed to connect to Saleor GraphQL API",
        }
    except httpx.RequestError as e:
        return {
            "success": False,
            "error": f"Request error: {str(e)}",
            "message": "Network error while connecting to Saleor API",
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "message": "An unexpected error occurred while fetching orders",
        }


# Get the HTTP app instance
app = mcp.http_app
