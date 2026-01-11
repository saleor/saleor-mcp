"""Stdio entry point for Saleor MCP server."""

import os

from fastmcp import FastMCP

from saleor_mcp.saleor_client.client import Client

# Get config from environment variables for stdio mode
SALEOR_API_URL = os.environ.get("SALEOR_API_URL", "https://api.mattscoinage.com/graphql/")
SALEOR_AUTH_TOKEN = os.environ.get("SALEOR_AUTH_TOKEN", "")

mcp = FastMCP("Saleor MCP Server")


def get_client() -> Client:
    """Get a Saleor client configured from environment variables."""
    if not SALEOR_AUTH_TOKEN:
        raise ValueError("SALEOR_AUTH_TOKEN environment variable is required")
    return Client(
        url=SALEOR_API_URL,
        headers={"Authorization": f"Bearer {SALEOR_AUTH_TOKEN}"}
    )


@mcp.tool()
async def list_channels() -> dict:
    """List all channels in Saleor."""
    client = get_client()
    result = await client.list_channels()
    channels = result.channels or []
    return {
        "channels": [
            {
                "id": ch.id,
                "name": ch.name,
                "slug": ch.slug,
                "isActive": ch.isActive,
                "currencyCode": ch.currencyCode,
            }
            for ch in channels
        ]
    }


@mcp.tool()
async def list_categories() -> dict:
    """List all categories in Saleor."""
    client = get_client()
    query = """
    query ListCategories {
        categories(first: 50) {
            edges {
                node {
                    id
                    name
                    slug
                }
            }
        }
    }
    """
    response = await client.execute(query=query, operation_name="ListCategories")
    data = client.get_data(response)
    categories = []
    if data.get("categories") and data["categories"].get("edges"):
        for edge in data["categories"]["edges"]:
            node = edge["node"]
            categories.append({
                "id": node["id"],
                "name": node["name"],
                "slug": node["slug"],
            })
    return {"categories": categories}


@mcp.tool()
async def update_product_category(product_id: str, category_id: str) -> dict:
    """Assign a category to a product."""
    client = get_client()
    query = """
    mutation ProductUpdate($id: ID!, $input: ProductInput!) {
        productUpdate(id: $id, input: $input) {
            product {
                id
                name
                category {
                    id
                    name
                }
            }
            errors {
                field
                message
            }
        }
    }
    """
    variables = {
        "id": product_id,
        "input": {"category": category_id}
    }
    response = await client.execute(query=query, operation_name="ProductUpdate", variables=variables)
    data = client.get_data(response)

    if data.get("productUpdate") and data["productUpdate"].get("errors"):
        errors = [e for e in data["productUpdate"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors}

    product = data.get("productUpdate", {}).get("product")
    return {
        "success": True,
        "product": product
    }


@mcp.tool()
async def create_category(name: str, slug: str = None) -> dict:
    """Create a new category in Saleor."""
    client = get_client()
    query = """
    mutation CategoryCreate($input: CategoryInput!) {
        categoryCreate(input: $input) {
            category {
                id
                name
                slug
            }
            errors {
                field
                message
            }
        }
    }
    """
    variables = {
        "input": {
            "name": name,
            "slug": slug or name.lower().replace(" ", "-"),
        }
    }
    response = await client.execute(query=query, operation_name="CategoryCreate", variables=variables)
    data = client.get_data(response)

    if data.get("categoryCreate") and data["categoryCreate"].get("errors"):
        errors = [e for e in data["categoryCreate"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors}

    category = data.get("categoryCreate", {}).get("category")
    return {
        "success": True,
        "category": category
    }


@mcp.tool()
async def list_products(channel: str = "opensensor-ocr", first: int = 20) -> dict:
    """List products in a channel with variant information."""
    client = get_client()
    result = await client.list_products(first=first, channel=channel)
    products = []
    if result.products and result.products.edges:
        for edge in result.products.edges:
            prod = edge.node
            # Extract variants
            variants = []
            if prod.productVariants and prod.productVariants.edges:
                for v_edge in prod.productVariants.edges:
                    v = v_edge.node
                    variants.append({
                        "id": v.id,
                        "name": v.name,
                        "sku": v.sku,
                    })
            products.append({
                "id": prod.id,
                "name": prod.name,
                "slug": prod.slug,
                "defaultVariantId": prod.defaultVariant.id if prod.defaultVariant else None,
                "variants": variants,
            })
    return {"products": products}


@mcp.tool()
async def create_channel(
    name: str,
    slug: str,
    currency_code: str = "USD",
    default_country: str = "US",
    is_active: bool = True,
) -> dict:
    """Create a new channel in Saleor."""
    from saleor_mcp.saleor_client.enums import CountryCode
    from saleor_mcp.saleor_client.input_types import ChannelCreateInput

    client = get_client()
    try:
        country_enum = CountryCode(default_country)
    except ValueError:
        country_enum = CountryCode.US

    input_data = ChannelCreateInput(
        name=name,
        slug=slug,
        currencyCode=currency_code,
        defaultCountry=country_enum,
        isActive=is_active,
    )
    result = await client.channel_create(input=input_data)

    if result.channelCreate and result.channelCreate.errors:
        errors = [{"field": e.field, "message": e.message} for e in result.channelCreate.errors if e.message]
        if errors:
            return {"success": False, "errors": errors}

    channel = result.channelCreate.channel if result.channelCreate else None
    return {
        "success": True,
        "channel": {
            "id": channel.id if channel else None,
            "name": channel.name if channel else None,
            "slug": channel.slug if channel else None,
        } if channel else None,
    }


@mcp.tool()
async def create_product(
    name: str,
    product_type_id: str,
    slug: str = None,
) -> dict:
    """Create a new product in Saleor."""
    from saleor_mcp.saleor_client.input_types import ProductCreateInput

    client = get_client()
    input_data = ProductCreateInput(
        name=name,
        productType=product_type_id,
        slug=slug,
    )
    result = await client.product_create(input=input_data)

    if result.productCreate and result.productCreate.errors:
        errors = [{"field": e.field, "message": e.message} for e in result.productCreate.errors if e.message]
        if errors:
            return {"success": False, "errors": errors}

    product = result.productCreate.product if result.productCreate else None
    return {
        "success": True,
        "product": {
            "id": product.id if product else None,
            "name": product.name if product else None,
            "slug": product.slug if product else None,
        } if product else None,
    }


@mcp.tool()
async def create_product_variant(
    product_id: str,
    sku: str,
    name: str = None,
) -> dict:
    """Create a product variant in Saleor.

    Args:
        product_id: ID of the parent product
        sku: Stock Keeping Unit (e.g., "OCR-1000")
        name: Variant name (optional)

    Returns:
        The created variant information including its ID.
    """
    from saleor_mcp.saleor_client.input_types import ProductVariantCreateInput

    client = get_client()
    input_data = ProductVariantCreateInput(
        product=product_id,
        sku=sku,
        name=name,
        attributes=[],  # Empty list for products without variant attributes
    )
    result = await client.product_variant_create(input=input_data)

    if result.productVariantCreate and result.productVariantCreate.errors:
        errors = [{"field": e.field, "message": e.message} for e in result.productVariantCreate.errors if e.message]
        if errors:
            return {"success": False, "errors": errors}

    variant = result.productVariantCreate.productVariant if result.productVariantCreate else None
    return {
        "success": True,
        "variant": {
            "id": variant.id if variant else None,
            "name": variant.name if variant else None,
            "sku": variant.sku if variant else None,
        } if variant else None,
    }


@mcp.tool()
async def publish_product_to_channel(
    product_id: str,
    channel_id: str,
    is_published: bool = True,
) -> dict:
    """Publish a product to a channel."""
    from saleor_mcp.saleor_client.input_types import (
        ProductChannelListingAddInput,
        ProductChannelListingUpdateInput,
    )

    client = get_client()
    input_data = ProductChannelListingUpdateInput(
        updateChannels=[
            ProductChannelListingAddInput(
                channelId=channel_id,
                isPublished=is_published,
                isAvailableForPurchase=True,
                visibleInListings=True,
            )
        ]
    )
    result = await client.product_channel_listing_update(id=product_id, input=input_data)

    if result.productChannelListingUpdate and result.productChannelListingUpdate.errors:
        errors = [{"field": e.field, "message": e.message} for e in result.productChannelListingUpdate.errors if e.message]
        if errors:
            return {"success": False, "errors": errors}

    return {"success": True, "product_id": product_id, "channel_id": channel_id}


@mcp.tool()
async def set_variant_price(
    variant_id: str,
    channel_id: str,
    price: float,
) -> dict:
    """Set the price of a product variant in a channel."""
    from saleor_mcp.saleor_client.input_types import ProductVariantChannelListingAddInput

    client = get_client()
    input_data = [
        ProductVariantChannelListingAddInput(
            channelId=channel_id,
            price=price,
        )
    ]
    result = await client.product_variant_channel_listing_update(id=variant_id, input=input_data)

    if result.productVariantChannelListingUpdate and result.productVariantChannelListingUpdate.errors:
        errors = [{"field": e.field, "message": e.message} for e in result.productVariantChannelListingUpdate.errors if e.message]
        if errors:
            return {"success": False, "errors": errors}

    return {"success": True, "variant_id": variant_id, "price": price}


@mcp.tool()
async def list_warehouses() -> dict:
    """List all warehouses in Saleor."""
    client = get_client()
    query = """
    query ListWarehouses {
        warehouses(first: 50) {
            edges {
                node {
                    id
                    name
                    slug
                }
            }
        }
    }
    """
    response = await client.execute(query=query, operation_name="ListWarehouses")
    data = client.get_data(response)
    warehouses = []
    if data.get("warehouses") and data["warehouses"].get("edges"):
        for edge in data["warehouses"]["edges"]:
            node = edge["node"]
            warehouses.append({
                "id": node["id"],
                "name": node["name"],
                "slug": node["slug"],
            })
    return {"warehouses": warehouses}


@mcp.tool()
async def set_variant_stock(variant_id: str, warehouse_id: str, quantity: int = 999999) -> dict:
    """Set stock quantity for a variant in a warehouse."""
    client = get_client()
    query = """
    mutation ProductVariantStocksCreate($variantId: ID!, $stocks: [StockInput!]!) {
        productVariantStocksCreate(variantId: $variantId, stocks: $stocks) {
            productVariant {
                id
                stocks {
                    warehouse {
                        id
                        name
                    }
                    quantity
                }
            }
            errors {
                field
                message
            }
        }
    }
    """
    variables = {
        "variantId": variant_id,
        "stocks": [{"warehouse": warehouse_id, "quantity": quantity}]
    }
    response = await client.execute(query=query, operation_name="ProductVariantStocksCreate", variables=variables)
    data = client.get_data(response)

    if data.get("productVariantStocksCreate") and data["productVariantStocksCreate"].get("errors"):
        errors = [e for e in data["productVariantStocksCreate"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors}

    variant = data.get("productVariantStocksCreate", {}).get("productVariant")
    return {
        "success": True,
        "variant": variant
    }


@mcp.tool()
async def list_sales(channel: str = None) -> dict:
    """List all sales/discounts in Saleor.

    Args:
        channel: Optional channel slug to filter sales by channel

    Returns:
        List of sales with their details including discount values per channel.
    """
    client = get_client()
    query = """
    query ListSales($channel: String) {
        sales(first: 50, channel: $channel) {
            edges {
                node {
                    id
                    name
                    startDate
                    endDate
                    type
                    variants(first: 100) {
                        edges {
                            node {
                                id
                                name
                                sku
                            }
                        }
                    }
                    products(first: 100) {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                    channelListings {
                        id
                        channel {
                            id
                            slug
                            name
                        }
                        discountValue
                        currency
                    }
                }
            }
        }
    }
    """
    variables = {"channel": channel} if channel else {}
    response = await client.execute(query=query, operation_name="ListSales", variables=variables)
    data = client.get_data(response)

    sales = []
    if data.get("sales") and data["sales"].get("edges"):
        for edge in data["sales"]["edges"]:
            node = edge["node"]
            variants = []
            if node.get("variants") and node["variants"].get("edges"):
                for v_edge in node["variants"]["edges"]:
                    v = v_edge["node"]
                    variants.append({"id": v["id"], "name": v["name"], "sku": v.get("sku")})

            products = []
            if node.get("products") and node["products"].get("edges"):
                for p_edge in node["products"]["edges"]:
                    p = p_edge["node"]
                    products.append({"id": p["id"], "name": p["name"]})

            sales.append({
                "id": node["id"],
                "name": node["name"],
                "type": node["type"],
                "startDate": node.get("startDate"),
                "endDate": node.get("endDate"),
                "variants": variants,
                "products": products,
                "channelListings": node.get("channelListings", []),
            })

    return {"sales": sales}


@mcp.tool()
async def create_sale(
    name: str,
    sale_type: str = "PERCENTAGE",
    variants: list[str] = None,
    products: list[str] = None,
    start_date: str = None,
    end_date: str = None,
) -> dict:
    """Create a new sale/discount in Saleor.

    Args:
        name: Name of the sale (e.g., "New Year Sale - 30% Off")
        sale_type: Type of discount - "PERCENTAGE" or "FIXED"
        variants: List of variant IDs to include in the sale
        products: List of product IDs to include in the sale
        start_date: Optional ISO date string for when sale starts
        end_date: Optional ISO date string for when sale ends

    Returns:
        The created sale information including its ID.
    """
    client = get_client()
    query = """
    mutation SaleCreate($input: SaleInput!) {
        saleCreate(input: $input) {
            sale {
                id
                name
                type
                startDate
                endDate
            }
            errors {
                field
                message
                code
            }
        }
    }
    """

    input_data = {
        "name": name,
        "type": sale_type,
    }

    if variants:
        input_data["variants"] = variants
    if products:
        input_data["products"] = products
    if start_date:
        input_data["startDate"] = start_date
    if end_date:
        input_data["endDate"] = end_date

    variables = {"input": input_data}
    response = await client.execute(query=query, operation_name="SaleCreate", variables=variables)
    data = client.get_data(response)

    if data.get("saleCreate") and data["saleCreate"].get("errors"):
        errors = [e for e in data["saleCreate"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors}

    sale = data.get("saleCreate", {}).get("sale")
    return {
        "success": True,
        "sale": sale
    }


@mcp.tool()
async def update_sale_channel_listing(
    sale_id: str,
    channel_id: str,
    discount_value: float,
) -> dict:
    """Update the discount value for a sale in a specific channel.

    Args:
        sale_id: ID of the sale to update
        channel_id: ID of the channel
        discount_value: Discount value (percentage or fixed amount depending on sale type)

    Returns:
        Success status and updated sale information.
    """
    client = get_client()
    query = """
    mutation SaleChannelListingUpdate($id: ID!, $input: SaleChannelListingInput!) {
        saleChannelListingUpdate(id: $id, input: $input) {
            sale {
                id
                name
                type
                channelListings {
                    id
                    channel {
                        id
                        slug
                        name
                    }
                    discountValue
                    currency
                }
            }
            errors {
                field
                message
                code
            }
        }
    }
    """

    variables = {
        "id": sale_id,
        "input": {
            "addChannels": [
                {
                    "channelId": channel_id,
                    "discountValue": discount_value
                }
            ]
        }
    }

    response = await client.execute(query=query, operation_name="SaleChannelListingUpdate", variables=variables)
    data = client.get_data(response)

    if data.get("saleChannelListingUpdate") and data["saleChannelListingUpdate"].get("errors"):
        errors = [e for e in data["saleChannelListingUpdate"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors}

    sale = data.get("saleChannelListingUpdate", {}).get("sale")
    return {
        "success": True,
        "sale": sale
    }


@mcp.tool()
async def delete_sale(sale_id: str) -> dict:
    """Delete a sale/discount from Saleor.

    Args:
        sale_id: ID of the sale to delete

    Returns:
        Success status.
    """
    client = get_client()
    query = """
    mutation SaleDelete($id: ID!) {
        saleDelete(id: $id) {
            sale {
                id
                name
            }
            errors {
                field
                message
                code
            }
        }
    }
    """

    variables = {"id": sale_id}
    response = await client.execute(query=query, operation_name="SaleDelete", variables=variables)
    data = client.get_data(response)

    if data.get("saleDelete") and data["saleDelete"].get("errors"):
        errors = [e for e in data["saleDelete"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors}

    return {"success": True, "deleted_sale_id": sale_id}


@mcp.tool()
async def get_product_pricing(
    channel: str = "opensensor-ocr",
    first: int = 20,
) -> dict:
    """Get product pricing including discounts for a channel.

    This returns both the regular price and discounted price (if a sale applies)
    for all product variants in a channel.

    Args:
        channel: Channel slug to get pricing for
        first: Number of products to fetch

    Returns:
        Products with pricing information including sale prices.
    """
    client = get_client()
    query = """
    query GetProductPricing($channel: String!, $first: Int!) {
        products(first: $first, channel: $channel) {
            edges {
                node {
                    id
                    name
                    slug
                    variants {
                        id
                        name
                        sku
                        pricing(address: {}) {
                            onSale
                            discount {
                                gross {
                                    amount
                                    currency
                                }
                            }
                            price {
                                gross {
                                    amount
                                    currency
                                }
                            }
                            priceUndiscounted {
                                gross {
                                    amount
                                    currency
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    """

    variables = {"channel": channel, "first": first}
    response = await client.execute(query=query, operation_name="GetProductPricing", variables=variables)
    data = client.get_data(response)

    products = []
    if data.get("products") and data["products"].get("edges"):
        for edge in data["products"]["edges"]:
            node = edge["node"]
            variants = []
            for variant in node.get("variants", []):
                pricing = variant.get("pricing", {})
                variants.append({
                    "id": variant["id"],
                    "name": variant["name"],
                    "sku": variant.get("sku"),
                    "onSale": pricing.get("onSale", False),
                    "price": pricing.get("price", {}).get("gross", {}).get("amount"),
                    "priceUndiscounted": pricing.get("priceUndiscounted", {}).get("gross", {}).get("amount"),
                    "discount": pricing.get("discount", {}).get("gross", {}).get("amount") if pricing.get("discount") else None,
                    "currency": pricing.get("price", {}).get("gross", {}).get("currency", "USD"),
                })
            products.append({
                "id": node["id"],
                "name": node["name"],
                "slug": node["slug"],
                "variants": variants,
            })

    return {"products": products}


@mcp.tool()
async def create_catalogue_promotion(
    name: str,
    reward_value: float,
    reward_value_type: str = "PERCENTAGE",
    product_ids: list[str] = None,
    variant_ids: list[str] = None,
    channel_ids: list[str] = None,
    start_date: str = None,
    end_date: str = None,
) -> dict:
    """Create a catalogue promotion that reduces product prices visibly.

    This is the modern way to create sales in Saleor 3.x. The discount will be
    visible on the ProductVariant.pricing.onSale field.

    Args:
        name: Name of the promotion (e.g., "30% Off OCR Credits")
        reward_value: Discount value (e.g., 30 for 30% off)
        reward_value_type: "PERCENTAGE" or "FIXED"
        product_ids: List of product IDs to include
        variant_ids: List of variant IDs to include
        channel_ids: List of channel IDs where promotion applies
        start_date: Optional ISO date string for when promotion starts
        end_date: Optional ISO date string for when promotion ends

    Returns:
        The created promotion and rule information.
    """
    client = get_client()

    # Step 1: Create the promotion
    create_mutation = """
    mutation PromotionCreate($input: PromotionCreateInput!) {
        promotionCreate(input: $input) {
            promotion {
                id
                name
                type
                startDate
                endDate
            }
            errors {
                field
                message
                code
            }
        }
    }
    """

    promo_input = {
        "name": name,
        "type": "CATALOGUE",
    }
    if start_date:
        promo_input["startDate"] = start_date
    if end_date:
        promo_input["endDate"] = end_date

    response = await client.execute(
        query=create_mutation,
        operation_name="PromotionCreate",
        variables={"input": promo_input}
    )
    data = client.get_data(response)

    if data.get("promotionCreate") and data["promotionCreate"].get("errors"):
        errors = [e for e in data["promotionCreate"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors}

    promotion = data.get("promotionCreate", {}).get("promotion")
    if not promotion:
        return {"success": False, "errors": [{"message": "Failed to create promotion"}]}

    promotion_id = promotion["id"]

    # Step 2: Create the promotion rule with catalogue predicate
    rule_mutation = """
    mutation PromotionRuleCreate($input: PromotionRuleCreateInput!) {
        promotionRuleCreate(input: $input) {
            promotionRule {
                id
                name
                rewardValueType
                rewardValue
                cataloguePredicate
                channels {
                    id
                    slug
                }
            }
            errors {
                field
                message
                code
            }
        }
    }
    """

    # Build catalogue predicate
    predicate_parts = []
    if product_ids:
        predicate_parts.append({"productPredicate": {"ids": product_ids}})
    if variant_ids:
        predicate_parts.append({"variantPredicate": {"ids": variant_ids}})

    if not predicate_parts:
        return {"success": False, "errors": [{"message": "Must provide product_ids or variant_ids"}]}

    catalogue_predicate = {"OR": predicate_parts} if len(predicate_parts) > 1 else predicate_parts[0]

    rule_input = {
        "name": f"{name} - Rule",
        "promotion": promotion_id,
        "rewardValueType": reward_value_type,
        "rewardValue": str(reward_value),
        "cataloguePredicate": catalogue_predicate,
    }

    if channel_ids:
        rule_input["channels"] = channel_ids

    response = await client.execute(
        query=rule_mutation,
        operation_name="PromotionRuleCreate",
        variables={"input": rule_input}
    )
    data = client.get_data(response)

    if data.get("promotionRuleCreate") and data["promotionRuleCreate"].get("errors"):
        errors = [e for e in data["promotionRuleCreate"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors, "promotion": promotion}

    rule = data.get("promotionRuleCreate", {}).get("promotionRule")

    return {
        "success": True,
        "promotion": promotion,
        "rule": rule
    }


@mcp.tool()
async def list_promotions() -> dict:
    """List all promotions in Saleor.

    Returns:
        List of promotions with their rules.
    """
    client = get_client()
    query = """
    query ListPromotions {
        promotions(first: 50) {
            edges {
                node {
                    id
                    name
                    type
                    startDate
                    endDate
                    rules {
                        id
                        name
                        rewardValueType
                        rewardValue
                        channels {
                            id
                            slug
                        }
                    }
                }
            }
        }
    }
    """

    response = await client.execute(query=query, operation_name="ListPromotions")
    data = client.get_data(response)

    promotions = []
    if data.get("promotions") and data["promotions"].get("edges"):
        for edge in data["promotions"]["edges"]:
            node = edge["node"]
            promotions.append({
                "id": node["id"],
                "name": node["name"],
                "type": node["type"],
                "startDate": node.get("startDate"),
                "endDate": node.get("endDate"),
                "rules": node.get("rules", []),
            })

    return {"promotions": promotions}


@mcp.tool()
async def delete_promotion(promotion_id: str) -> dict:
    """Delete a promotion from Saleor.

    Args:
        promotion_id: ID of the promotion to delete

    Returns:
        Success status.
    """
    client = get_client()
    query = """
    mutation PromotionDelete($id: ID!) {
        promotionDelete(id: $id) {
            promotion {
                id
                name
            }
            errors {
                field
                message
                code
            }
        }
    }
    """

    response = await client.execute(
        query=query,
        operation_name="PromotionDelete",
        variables={"id": promotion_id}
    )
    data = client.get_data(response)

    if data.get("promotionDelete") and data["promotionDelete"].get("errors"):
        errors = [e for e in data["promotionDelete"]["errors"] if e.get("message")]
        if errors:
            return {"success": False, "errors": errors}

    return {"success": True, "deleted_promotion_id": promotion_id}


def main():
    mcp.run()


if __name__ == "__main__":
    main()

