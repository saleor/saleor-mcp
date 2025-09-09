import pytest

from saleor_mcp.config import SaleorConfig
from saleor_mcp.saleor_client.list_orders import ListOrders


@pytest.fixture
def mock_saleor_config():
    return SaleorConfig(api_url="http://example.com/graphql", auth_token="test-token")


@pytest.fixture
def sample_orders_response():
    return ListOrders(
        orders={
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
                        "userEmail": "customer@example.com",
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
                            "firstName": "John",
                            "lastName": "Doe",
                            "streetAddress1": "123 Main St",
                            "streetAddress2": "Apt 4B",
                            "city": "Anytown",
                            "postalCode": "12345",
                            "country": {"code": "US", "country": "United States"},
                        },
                        "billingAddress": {
                            "firstName": "John",
                            "lastName": "Doe",
                            "streetAddress1": "123 Main St",
                            "streetAddress2": "Apt 4B",
                            "city": "Anytown",
                            "postalCode": "12345",
                            "country": {"code": "US", "country": "United States"},
                        },
                    }
                },
            ],
            "pageInfo": {
                "hasNextPage": True,
                "hasPreviousPage": False,
                "startCursor": "cursor123",
                "endCursor": "cursor456",
            },
        }
    )
