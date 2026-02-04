import time
from contextlib import asynccontextmanager

from opentelemetry import metrics
from opentelemetry.util.types import AttributeValue

from .mcp_attributes import METRIC_OPERATION_COUNT, METRIC_OPERATION_DURATION

meter = metrics.get_meter("saleor-mcp")

OPERATION_COUNTER = meter.create_counter(
    unit="1",
    name=METRIC_OPERATION_COUNT,
    description="Total number of MCP operations",
)

OPERATION_DURATION = meter.create_histogram(
    unit="ms",
    name=METRIC_OPERATION_DURATION,
    description="Duration of MCP operations in milliseconds",
)


@asynccontextmanager
async def record_duration(attributes: dict[str, AttributeValue] | None = None):
    if attributes is None:
        attributes = {}

    start = time.monotonic_ns()
    try:
        yield attributes, start
    finally:
        duration = time.monotonic_ns() - start
        OPERATION_DURATION.record(duration, attributes)


@asynccontextmanager
async def record_operation_count(attributes: dict[str, AttributeValue] | None = None):
    if attributes is None:
        attributes = {}

    OPERATION_COUNTER.add(1, attributes)

    try:
        yield attributes
    finally:
        pass
