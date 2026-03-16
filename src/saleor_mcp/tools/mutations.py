from typing import Any, Optional

from fastmcp import Context, FastMCP

from ..ctx_utils import get_saleor_client
from ..saleor_client.enums import CountryCode
from ..saleor_client.input_types import (
    ChannelCreateInput,
    ProductChannelListingAddInput,
    ProductChannelListingUpdateInput,
    ProductCreateInput,
    ProductTypeInput,
    ProductVariantChannelListingAddInput,
    ProductVariantCreateInput,
    PriceInput,
    ShippingZoneUpdateInput,
)

mutations_router = FastMCP("Mutations MCP")


@mutations_router.tool(
    annotations={
        "title": "Create channel",
        "readOnlyHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    }
)
async def create_channel(
    ctx: Context,
    name: str,
    slug: str,
    currency_code: str = "USD",
    default_country: str = "US",
    is_active: bool = True,
) -> dict[str, Any]:
    """Create a new channel in Saleor.

    Args:
        name: Name of the channel (e.g., "OpenSensor OCR")
        slug: URL-friendly slug for the channel (e.g., "opensensor-ocr")
        currency_code: Currency code (default: USD)
        default_country: Default country code (default: US)
        is_active: Whether the channel is active (default: True)

    Returns:
        The created channel information including ID, slug, name, and status.
    """
    client = get_saleor_client()

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

    try:
        result = await client.channel_create(input=input_data)
    except Exception as e:
        await ctx.error(str(e))
        raise

    if result.channelCreate and result.channelCreate.errors:
        errors = [
            {"field": e.field, "message": e.message, "code": e.code.value}
            for e in result.channelCreate.errors
        ]
        if errors:
            return {"success": False, "errors": errors}

    channel = result.channelCreate.channel if result.channelCreate else None
    return {
        "success": True,
        "channel": {
            "id": channel.id if channel else None,
            "slug": channel.slug if channel else None,
            "name": channel.name if channel else None,
            "isActive": channel.isActive if channel else None,
            "currencyCode": channel.currencyCode if channel else None,
            "defaultCountry": channel.defaultCountry.code if channel else None,
        } if channel else None,
    }


@mutations_router.tool(
    annotations={
        "title": "Create product type",
        "readOnlyHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    }
)
async def create_product_type(
    ctx: Context,
    name: str,
    slug: Optional[str] = None,
    is_digital: bool = True,
    is_shipping_required: bool = False,
    has_variants: bool = False,
) -> dict[str, Any]:
    """Create a new product type in Saleor.

    Args:
        name: Name of the product type (e.g., "Digital Credits")
        slug: URL-friendly slug (optional, auto-generated if not provided)
        is_digital: Whether products are digital (default: True for credits)
        is_shipping_required: Whether shipping is required (default: False)
        has_variants: Whether products have multiple variants (default: False)

    Returns:
        The created product type information.
    """
    client = get_saleor_client()

    input_data = ProductTypeInput(
        name=name,
        slug=slug,
        isDigital=is_digital,
        isShippingRequired=is_shipping_required,
        hasVariants=has_variants,
    )

    try:
        result = await client.product_type_create(input=input_data)
    except Exception as e:
        await ctx.error(str(e))
        raise

    if result.productTypeCreate and result.productTypeCreate.errors:
        errors = [
            {"field": e.field, "message": e.message, "code": e.code.value}
            for e in result.productTypeCreate.errors
        ]
        if errors:
            return {"success": False, "errors": errors}

    pt = result.productTypeCreate.productType if result.productTypeCreate else None
    return {
        "success": True,
        "productType": {
            "id": pt.id if pt else None,
            "name": pt.name if pt else None,
            "slug": pt.slug if pt else None,
            "isDigital": pt.isDigital if pt else None,
            "isShippingRequired": pt.isShippingRequired if pt else None,
            "hasVariants": pt.hasVariants if pt else None,
        } if pt else None,
    }


@mutations_router.tool(
    annotations={
        "title": "Create product",
        "readOnlyHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    }
)
async def create_product(
    ctx: Context,
    name: str,
    product_type_id: str,
    slug: Optional[str] = None,
    description: Optional[str] = None,
) -> dict[str, Any]:
    """Create a new product in Saleor.

    Args:
        name: Name of the product (e.g., "OCR Credits - 2,000 Pages")
        product_type_id: ID of the product type
        slug: URL-friendly slug (optional)
        description: Product description in JSON format (optional)

    Returns:
        The created product information.
    """
    client = get_saleor_client()

    input_data = ProductCreateInput(
        name=name,
        productType=product_type_id,
        slug=slug,
        description=description,
    )

    try:
        result = await client.product_create(input=input_data)
    except Exception as e:
        await ctx.error(str(e))
        raise

    if result.productCreate and result.productCreate.errors:
        errors = [
            {"field": e.field, "message": e.message, "code": e.code.value}
            for e in result.productCreate.errors
        ]
        if errors:
            return {"success": False, "errors": errors}

    product = result.productCreate.product if result.productCreate else None
    return {
        "success": True,
        "product": {
            "id": product.id if product else None,
            "name": product.name if product else None,
            "slug": product.slug if product else None,
            "productType": {
                "id": product.productType.id,
                "name": product.productType.name,
            } if product and product.productType else None,
        } if product else None,
    }


@mutations_router.tool(
    annotations={
        "title": "Create product variant",
        "readOnlyHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    }
)
async def create_product_variant(
    ctx: Context,
    product_id: str,
    sku: str,
    name: Optional[str] = None,
) -> dict[str, Any]:
    """Create a product variant in Saleor.

    Args:
        product_id: ID of the parent product
        sku: Stock Keeping Unit (e.g., "ocr-credits-2000")
        name: Variant name (optional)

    Returns:
        The created variant information.
    """
    client = get_saleor_client()

    input_data = ProductVariantCreateInput(
        product=product_id,
        sku=sku,
        name=name,
    )

    try:
        result = await client.product_variant_create(input=input_data)
    except Exception as e:
        await ctx.error(str(e))
        raise

    if result.productVariantCreate and result.productVariantCreate.errors:
        errors = [
            {"field": e.field, "message": e.message, "code": e.code.value}
            for e in result.productVariantCreate.errors
        ]
        if errors:
            return {"success": False, "errors": errors}

    variant = result.productVariantCreate.productVariant if result.productVariantCreate else None
    return {
        "success": True,
        "variant": {
            "id": variant.id if variant else None,
            "name": variant.name if variant else None,
            "sku": variant.sku if variant else None,
            "product": {
                "id": variant.product.id,
                "name": variant.product.name,
            } if variant and variant.product else None,
        } if variant else None,
    }


@mutations_router.tool(
    annotations={
        "title": "Publish product to channel",
        "readOnlyHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    }
)
async def publish_product_to_channel(
    ctx: Context,
    product_id: str,
    channel_id: str,
    is_published: bool = True,
    is_available_for_purchase: bool = True,
    visible_in_listings: bool = True,
) -> dict[str, Any]:
    """Publish a product to a specific channel.

    Args:
        product_id: ID of the product to publish
        channel_id: ID of the channel to publish to
        is_published: Whether the product is published (default: True)
        is_available_for_purchase: Whether available for purchase (default: True)
        visible_in_listings: Whether visible in listings (default: True)

    Returns:
        The updated product channel listing information.
    """
    client = get_saleor_client()

    input_data = ProductChannelListingUpdateInput(
        updateChannels=[
            ProductChannelListingAddInput(
                channelId=channel_id,
                isPublished=is_published,
                isAvailableForPurchase=is_available_for_purchase,
                visibleInListings=visible_in_listings,
            )
        ]
    )

    try:
        result = await client.product_channel_listing_update(id=product_id, input=input_data)
    except Exception as e:
        await ctx.error(str(e))
        raise

    if result.productChannelListingUpdate and result.productChannelListingUpdate.errors:
        errors = [
            {"field": e.field, "message": e.message, "code": e.code.value}
            for e in result.productChannelListingUpdate.errors
        ]
        if errors:
            return {"success": False, "errors": errors}

    product = result.productChannelListingUpdate.product if result.productChannelListingUpdate else None
    return {
        "success": True,
        "product": {
            "id": product.id if product else None,
            "name": product.name if product else None,
            "channelListings": [
                {
                    "channel": {
                        "id": cl.channel.id,
                        "slug": cl.channel.slug,
                        "name": cl.channel.name,
                    },
                    "isPublished": cl.isPublished,
                    "isAvailableForPurchase": cl.isAvailableForPurchase,
                    "visibleInListings": cl.visibleInListings,
                }
                for cl in product.channelListings
            ] if product and product.channelListings else [],
        } if product else None,
    }


@mutations_router.tool(
    annotations={
        "title": "Set variant price in channel",
        "readOnlyHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    }
)
async def set_variant_price(
    ctx: Context,
    variant_id: str,
    channel_id: str,
    price: float,
    currency: str = "USD",
) -> dict[str, Any]:
    """Set the price of a product variant in a specific channel.

    Args:
        variant_id: ID of the product variant
        channel_id: ID of the channel
        price: Price amount (e.g., 20.00)
        currency: Currency code (default: USD)

    Returns:
        The updated variant channel listing information.
    """
    client = get_saleor_client()

    input_data = [
        ProductVariantChannelListingAddInput(
            channelId=channel_id,
            price=price,
        )
    ]

    try:
        result = await client.product_variant_channel_listing_update(id=variant_id, input=input_data)
    except Exception as e:
        await ctx.error(str(e))
        raise

    if result.productVariantChannelListingUpdate and result.productVariantChannelListingUpdate.errors:
        errors = [
            {"field": e.field, "message": e.message, "code": e.code.value}
            for e in result.productVariantChannelListingUpdate.errors
        ]
        if errors:
            return {"success": False, "errors": errors}

    variant = result.productVariantChannelListingUpdate.variant if result.productVariantChannelListingUpdate else None
    return {
        "success": True,
        "variant": {
            "id": variant.id if variant else None,
            "name": variant.name if variant else None,
            "channelListings": [
                {
                    "channel": {
                        "id": cl.channel.id,
                        "slug": cl.channel.slug,
                    },
                    "price": {
                        "amount": cl.price.amount if cl.price else None,
                        "currency": cl.price.currency if cl.price else None,
                    },
                }
                for cl in variant.channelListings
            ] if variant and variant.channelListings else [],
        } if variant else None,
    }


@mutations_router.tool(
    annotations={
        "title": "List shipping zones",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def list_shipping_zones(
    ctx: Context,
) -> dict[str, Any]:
    """List all shipping zones in Saleor.

    Returns:
        List of shipping zones with their warehouses and channels.
    """
    client = get_saleor_client()

    try:
        result = await client.list_shipping_zones(first=50)
    except Exception as e:
        await ctx.error(str(e))
        raise

    zones = []
    if result.shippingZones and result.shippingZones.edges:
        for edge in result.shippingZones.edges:
            node = edge.node
            zones.append({
                "id": node.id,
                "name": node.name,
                "warehouses": [{"id": w.id, "name": w.name} for w in node.warehouses],
                "channels": [{"id": c.id, "name": c.name, "slug": c.slug} for c in node.channels],
            })

    return {"shippingZones": zones}


@mutations_router.tool(
    annotations={
        "title": "Add channel to shipping zone",
        "readOnlyHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def add_channel_to_shipping_zone(
    ctx: Context,
    shipping_zone_id: str,
    channel_id: str,
) -> dict[str, Any]:
    """Add a channel to a shipping zone.

    This is required for digital products to have their stock visible in a channel.

    Args:
        shipping_zone_id: ID of the shipping zone
        channel_id: ID of the channel to add

    Returns:
        The updated shipping zone information.
    """
    client = get_saleor_client()

    input_data = ShippingZoneUpdateInput(
        addChannels=[channel_id]
    )

    try:
        result = await client.shipping_zone_update(id=shipping_zone_id, input=input_data)
    except Exception as e:
        await ctx.error(str(e))
        raise

    if result.shippingZoneUpdate and result.shippingZoneUpdate.errors:
        errors = [
            {"field": e.field, "message": e.message, "code": e.code}
            for e in result.shippingZoneUpdate.errors
        ]
        if errors:
            return {"success": False, "errors": errors}

    zone = result.shippingZoneUpdate.shippingZone if result.shippingZoneUpdate else None
    return {
        "success": True,
        "shippingZone": {
            "id": zone.id if zone else None,
            "name": zone.name if zone else None,
            "warehouses": [{"id": w.id, "name": w.name} for w in zone.warehouses] if zone else [],
            "channels": [{"id": c.id, "name": c.name, "slug": c.slug} for c in zone.channels] if zone else [],
        } if zone else None,
    }

