from typing import Sequence

from opentelemetry import trace
from opentelemetry.context import Context as OTContext
from opentelemetry.trace import SpanKind, Link
from opentelemetry.util.types import Attributes

tracer = trace.get_tracer("saleor-mcp")


def start_as_current_span(
    name: str,
    *,
    kind: SpanKind = SpanKind.INTERNAL,
    context: OTContext | None = None,
    attributes: Attributes | None = None,
    links: Sequence[Link] | None = None,
    start_time: int | None = None,
    record_exception: bool = True,
    set_status_on_exception: bool = True,
    end_on_exit: bool = True,
):
    """
    Wrapper around tracer.start_as_current_span.

    Returns a sync context manager
    """
    return tracer.start_as_current_span(
        name,
        kind=kind,
        links=links,
        context=context,
        attributes=attributes,
        start_time=start_time,
        end_on_exit=end_on_exit,
        record_exception=record_exception,
        set_status_on_exception=set_status_on_exception,
    )
