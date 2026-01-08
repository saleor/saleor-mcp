import pytest

from saleor_mcp.config import SaleorConfig
from saleor_mcp.saleor_client.count_orders import CountOrders
from saleor_mcp.saleor_client.list_channels import ListChannels
from saleor_mcp.saleor_client.list_customers import ListCustomers
from saleor_mcp.saleor_client.list_orders import ListOrders
from saleor_mcp.saleor_client.list_products import ListProducts
from saleor_mcp.saleor_client.list_stocks import ListStocks
from saleor_mcp.saleor_client.warehouse_details import WarehouseDetails


@pytest.fixture
def mock_saleor_config():
    return SaleorConfig(api_url="http://example.com/graphql", auth_token="test-token")


@pytest.fixture
def sample_orders_response():
    return ListOrders.model_validate(
        {
            "orders": {
                "edges": [
                    {
                        "node": {
                            "id": "T3JkZXI6MQ==",
                            "number": "001",
                            "status": "FULFILLED",
                            "created": "2023-01-01T00:00:00Z",
                            "updatedAt": "2023-01-02T00:00:00Z",
                            "paymentStatus": "FULLY_CHARGED",
                            "total": {"gross": {"amount": 100.50, "currency": "USD"}},
                            "lines": [
                                {
                                    "quantity": 2,
                                    "unitPrice": {
                                        "gross": {"amount": 50.25, "currency": "USD"}
                                    },
                                    "productName": "Test Product",
                                    "productSku": "TEST-SKU",
                                    "variantName": "Default",
                                    "productId": "UHJvZHVjdDo=",
                                    "variant": {
                                        "id": "UHJvZHVjdFZhcmlhbnQ6MQ==",
                                        "name": "Test Variant",
                                        "product": {
                                            "id": "UHJvZHVjdDo=",
                                            "name": "Test Product",
                                        },
                                    },
                                }
                            ],
                            "shippingAddress": {
                                "country": {"code": "US", "country": "United States"},
                            },
                            "billingAddress": {
                                "country": {"code": "US", "country": "United States"},
                            },
                        }
                    },
                ],
                "totalCount": 1,
                "pageInfo": {
                    "hasNextPage": True,
                    "hasPreviousPage": False,
                    "startCursor": "cursor123",
                    "endCursor": "cursor456",
                },
            }
        }
    )


@pytest.fixture
def sample_count_orders_response():
    """Fixture for count orders response."""
    return CountOrders.model_validate({"orders": {"totalCount": 42}})


@pytest.fixture
def empty_count_orders_response():
    """Fixture for empty count orders response."""
    return CountOrders.model_validate({"orders": {"totalCount": 0}})


@pytest.fixture
def sample_channels_response():
    """Fixture for channels response with multiple channels."""
    return ListChannels.model_validate(
        {
            "channels": [
                {
                    "id": "Q2hhbm5lbDox",
                    "slug": "default-channel",
                    "name": "Default Channel",
                    "isActive": True,
                    "currencyCode": "USD",
                    "defaultCountry": {"code": "US"},
                    "warehouses": [
                        {"id": "V2FyZWhvdXNlOjE=", "name": "US Warehouse"},
                        {"id": "V2FyZWhvdXNlOjI=", "name": "US East Warehouse"},
                    ],
                },
                {
                    "id": "Q2hhbm5lbDoy",
                    "slug": "eu-channel",
                    "name": "Europe Channel",
                    "isActive": True,
                    "currencyCode": "EUR",
                    "defaultCountry": {"code": "DE"},
                    "warehouses": [
                        {"id": "V2FyZWhvdXNlOjM=", "name": "EU Warehouse"},
                    ],
                },
                {
                    "id": "Q2hhbm5lbDoz",
                    "slug": "uk-channel",
                    "name": "UK Channel",
                    "isActive": False,
                    "currencyCode": "GBP",
                    "defaultCountry": {"code": "GB"},
                    "warehouses": [],
                },
            ]
        }
    )


@pytest.fixture
def empty_channels_response():
    """Fixture for empty channels response."""
    return ListChannels(channels=[])


@pytest.fixture
def sample_customers_response():
    """Fixture for customers response with multiple customers."""
    return ListCustomers.model_validate(
        {
            "customers": {
                "edges": [
                    {
                        "node": {
                            "id": "VXNlcjox",
                            "isActive": True,
                            "languageCode": "EN_US",
                            "lastLogin": "2023-11-01T10:30:00Z",
                            "dateJoined": "2023-01-15T08:00:00Z",
                            "defaultShippingAddress": {
                                "country": {"code": "US"},
                            },
                            "defaultBillingAddress": {
                                "country": {"code": "US"},
                            },
                        }
                    },
                    {
                        "node": {
                            "id": "VXNlcjoy",
                            "isActive": True,
                            "languageCode": "EN_GB",
                            "lastLogin": None,
                            "dateJoined": "2023-10-20T14:25:00Z",
                            "defaultShippingAddress": None,
                            "defaultBillingAddress": None,
                        }
                    },
                    {
                        "node": {
                            "id": "VXNlcjoz",
                            "isActive": False,
                            "languageCode": "DE",
                            "lastLogin": "2023-05-15T12:00:00Z",
                            "dateJoined": "2022-12-01T09:00:00Z",
                            "defaultShippingAddress": {
                                "country": {"code": "DE"},
                            },
                            "defaultBillingAddress": None,
                        }
                    },
                ],
                "totalCount": 3,
                "pageInfo": {
                    "hasNextPage": True,
                    "hasPreviousPage": False,
                    "startCursor": "Y3VzdG9tZXI6MQ==",
                    "endCursor": "Y3VzdG9tZXI6Mw==",
                },
            }
        }
    )


@pytest.fixture
def empty_customers_response():
    """Fixture for empty customers response."""
    return ListCustomers.model_validate(
        {
            "customers": {
                "edges": [],
                "totalCount": 0,
                "pageInfo": {
                    "hasNextPage": False,
                    "hasPreviousPage": False,
                    "startCursor": None,
                    "endCursor": None,
                },
            }
        }
    )


@pytest.fixture
def sample_products_response():
    """Fixture for products response with multiple products."""
    return ListProducts.model_validate(
        {
            "products": {
                "edges": [
                    {
                        "node": {
                            "id": "UHJvZHVjdDox",
                            "name": "Blue Hoodie",
                            "slug": "blue-hoodie",
                            "externalReference": "PROD-001",
                            "productType": {
                                "id": "UHJvZHVjdFR5cGU6MQ==",
                                "name": "Apparel",
                            },
                            "category": {"id": "Q2F0ZWdvcnk6MQ==", "name": "Hoodies"},
                            "defaultVariant": {"id": "UHJvZHVjdFZhcmlhbnQ6MQ=="},
                            "productVariants": {
                                "edges": [
                                    {
                                        "node": {
                                            "id": "UHJvZHVjdFZhcmlhbnQ6MQ==",
                                            "name": "S",
                                            "sku": "BLUE-HOODIE-S",
                                        }
                                    },
                                    {
                                        "node": {
                                            "id": "UHJvZHVjdFZhcmlhbnQ6Mg==",
                                            "name": "M",
                                            "sku": "BLUE-HOODIE-M",
                                        }
                                    },
                                ]
                            },
                            "created": "2023-01-01T00:00:00Z",
                            "updatedAt": "2023-01-02T00:00:00Z",
                            "thumbnail": {"url": "https://example.com/thumb.jpg"},
                            "pricing": {
                                "priceRange": {
                                    "start": {
                                        "gross": {"currency": "USD", "amount": 29.99}
                                    },
                                    "stop": {
                                        "gross": {"currency": "USD", "amount": 39.99}
                                    },
                                }
                            },
                        }
                    },
                    {
                        "node": {
                            "id": "UHJvZHVjdDoy",
                            "name": "Red T-Shirt",
                            "slug": "red-t-shirt",
                            "externalReference": None,
                            "productType": {
                                "id": "UHJvZHVjdFR5cGU6MQ==",
                                "name": "Apparel",
                            },
                            "category": {"id": "Q2F0ZWdvcnk6Mg==", "name": "T-Shirts"},
                            "defaultVariant": None,
                            "productVariants": {"edges": []},
                            "created": "2023-02-01T00:00:00Z",
                            "updatedAt": "2023-02-02T00:00:00Z",
                            "thumbnail": None,
                            "pricing": None,
                        }
                    },
                ],
                "totalCount": 2,
                "pageInfo": {
                    "hasNextPage": True,
                    "hasPreviousPage": False,
                    "startCursor": "YXJyYXljb25uZWN0aW9uOjA=",
                    "endCursor": "YXJyYXljb25uZWN0aW9uOjE=",
                },
            }
        }
    )


@pytest.fixture
def empty_products_response():
    """Fixture for empty products response."""
    return ListProducts.model_validate(
        {
            "products": {
                "edges": [],
                "totalCount": 0,
                "pageInfo": {
                    "hasNextPage": False,
                    "hasPreviousPage": False,
                    "startCursor": None,
                    "endCursor": None,
                },
            }
        }
    )


@pytest.fixture
def sample_stocks_response():
    """Fixture for stocks response with multiple stocks."""
    return ListStocks.model_validate(
        {
            "stocks": {
                "edges": [
                    {
                        "node": {
                            "id": "U3RvY2s6MQ==",
                            "quantity": 100,
                            "quantityAllocated": 20,
                            "warehouse": {"id": "V2FyZWhvdXNlOjE="},
                            "productVariant": {
                                "id": "UHJvZHVjdFZhcmlhbnQ6MQ==",
                                "name": "Blue / S",
                                "product": {
                                    "id": "UHJvZHVjdDox",
                                    "name": "Blue Hoodie",
                                },
                            },
                        }
                    },
                    {
                        "node": {
                            "id": "U3RvY2s6Mg==",
                            "quantity": 50,
                            "quantityAllocated": 5,
                            "warehouse": {"id": "V2FyZWhvdXNlOjI="},
                            "productVariant": {
                                "id": "UHJvZHVjdFZhcmlhbnQ6Mg==",
                                "name": "Red / M",
                                "product": {
                                    "id": "UHJvZHVjdDoy",
                                    "name": "Red T-Shirt",
                                },
                            },
                        }
                    },
                ],
                "totalCount": 2,
                "pageInfo": {
                    "hasNextPage": False,
                    "hasPreviousPage": False,
                    "startCursor": "YXJyYXljb25uZWN0aW9uOjA=",
                    "endCursor": "YXJyYXljb25uZWN0aW9uOjE=",
                },
            }
        }
    )


@pytest.fixture
def empty_stocks_response():
    """Fixture for empty stocks response."""
    return ListStocks.model_validate(
        {
            "stocks": {
                "edges": [],
                "totalCount": 0,
                "pageInfo": {
                    "hasNextPage": False,
                    "hasPreviousPage": False,
                    "startCursor": None,
                    "endCursor": None,
                },
            }
        }
    )


@pytest.fixture
def sample_warehouse_response():
    """Fixture for warehouse details response."""
    return WarehouseDetails.model_validate(
        {
            "warehouse": {
                "id": "V2FyZWhvdXNlOjE=",
                "name": "US East Warehouse",
                "slug": "us-east",
                "address": {
                    "city": "New York",
                    "postalCode": "10001",
                    "country": {"code": "US"},
                },
                "clickAndCollectOption": "DISABLED",
                "shippingZones": {
                    "edges": [
                        {
                            "node": {
                                "id": "U2hpcHBpbmdab25lOjE=",
                                "name": "US Zone",
                                "description": "United States shipping zone",
                                "channels": [
                                    {
                                        "id": "Q2hhbm5lbDox",
                                        "slug": "default-channel",
                                        "name": "Default Channel",
                                    }
                                ],
                                "countries": [
                                    {"code": "US", "country": "United States"}
                                ],
                            }
                        }
                    ]
                },
                "metadata": [
                    {"key": "warehouse_type", "value": "main"},
                    {"key": "region", "value": "northeast"},
                ],
            }
        }
    )


@pytest.fixture
def empty_warehouse_response():
    """Fixture for empty warehouse response (warehouse not found)."""
    return WarehouseDetails(warehouse=None)
