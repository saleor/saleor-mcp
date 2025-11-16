import functools
import uuid
from contextlib import asynccontextmanager
from enum import Enum
from typing import Any, AsyncIterator, Optional, Callable, Sequence

from opentelemetry.sdk._configuration import _OTelSDKConfigurator
from opentelemetry.sdk.resources import SERVICE_INSTANCE_ID, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.trace import StatusCode, Link
from opentelemetry.util.types import Attributes

from . import mcp_attributes
from .metric import record_duration, record_operation_count
from .trace import start_as_current_span


class Kind(Enum):
    CLIENT = "client"
    TOOL = "tool"


@asynccontextmanager
async def operation_context(
    *,
    operation_kind: str,
    operation_name: str,
    attributes: Attributes | None = None,
    links: Sequence[Link] | None = None,
    record_exception: bool = True,
    set_status_on_exception: bool = True,
    end_on_exit: bool = True,
) -> AsyncIterator[tuple[Any, dict[str, Any]]]:
    """Telemetry wrapper for a single MCP operation.

    Creates a tracing span and records all related metrics:
    - operation count (increments once per call)
    - operation duration (nanoseconds)
    - operation errors (increments on exception)
    """

    metric_attrs: dict[str, Any] = dict(attributes or {})
    metric_attrs.setdefault(mcp_attributes.MCP_OPERATION_KIND, operation_kind)
    metric_attrs.setdefault(mcp_attributes.MCP_OPERATION_NAME, operation_name)
    span_name = f"mcp.{operation_kind}.{operation_name}"
    async with record_operation_count(metric_attrs):
        async with record_duration(metric_attrs) as (metric_attrs, start_time):
            with start_as_current_span(
                span_name,
                links=links,
                start_time=start_time,
                end_on_exit=end_on_exit,
                attributes=metric_attrs,
                record_exception=record_exception,
                set_status_on_exception=set_status_on_exception,
            ) as span:
                yield span, metric_attrs
                span.set_status(status=StatusCode.OK)


def instrument(
    kind: Kind,
    *,
    name: str | None = None,
    include_args: bool = True,
    record_exception: bool = True,
    set_status_on_exception: bool = True,
    end_on_exit: bool = True,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator to instrument MCP operations with tracing + metrics.

    Args:
        kind:
            Logical kind of operation (e.g. Kind.TOOL).
        name:
            Optional explicit operation name. Defaults to function __name__.
        include_args:
            If True, adds function kwargs as span attributes, prefixed with
            "mcp.<kind>.input.".
        record_exception:
            Passed through to operation_context / tracer.
        set_status_on_exception:
            Passed through to operation_context / tracer.
        end_on_exit:
            Passed through to operation_context / tracer.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        op_name = name or func.__name__

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            attrs: dict[str, Any] = {}
            if kind is Kind.TOOL:
                attrs[mcp_attributes.MCP_TOOL_NAME] = op_name

            async with operation_context(
                operation_kind=kind.value,
                operation_name=op_name,
                attributes=attrs,
                end_on_exit=end_on_exit,
                record_exception=record_exception,
                set_status_on_exception=set_status_on_exception,
            ) as (span, metric_attrs):
                if include_args and kwargs:
                    prefix = f"mcp.{kind.value}.input."
                    for key, value in kwargs.items():
                        value_str = str(value)
                        span.set_attribute(prefix + key, value_str)
                result = await func(*args, **kwargs)
                return result

        return wrapper

    return decorator


def otel_configure_sdk(
    service_name: str,
    service_version: str,
    additional_attributes: dict[str, Any] | None = None,
):
    resource_attributes = {
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
        SERVICE_INSTANCE_ID: str(uuid.uuid4()),
    }

    if additional_attributes:
        resource_attributes.update(additional_attributes)

    configurator = _OTelSDKConfigurator()
    configurator.configure(resource_attributes=resource_attributes)


def initialise_telemetry(
    service_name: str,
    service_version: str,
    additional_attributes: Optional[dict[str, Any]] = None,
):
    """
    Initialise OpenTelemetry SDK with resource attributes.

    Args:
        service_name: Name of the MCP server
        service_version: Version of the MCP server
        additional_attributes: Additional resource attributes
    """
    otel_configure_sdk(service_name, service_version, additional_attributes)