from contextlib import asynccontextmanager

import pytest

from saleor_mcp.settings import settings


@asynccontextmanager
async def settings_override(**kwargs):
    original_settings = settings.model_dump()
    for key, value in kwargs.items():
        setattr(settings, key, value)
    yield
    for key, value in original_settings.items():
        setattr(settings, key, value)


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
