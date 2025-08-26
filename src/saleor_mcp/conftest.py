from unittest.mock import MagicMock

import pytest
from fastmcp.server.context import Context, set_context


@pytest.fixture
def context():
    context = Context(fastmcp=MagicMock())
    return set_context(context)


@pytest.fixture
def mock_http_headers():
    return {
        "x-saleor-api-url": "https://example.saleor.cloud/graphql/",
        "x-saleor-auth-token": "test-token",
    }


@pytest.fixture
def sample_orders_response():
    return {
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
    }
