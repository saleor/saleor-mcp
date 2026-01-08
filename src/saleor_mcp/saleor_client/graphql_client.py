from typing import Optional, Any, Dict, Tuple, IO, List

from opentelemetry.propagate import inject
from opentelemetry.trace import SpanKind

from .client import Client
from ..telemetry import mcp_attributes
from ..telemetry import tracer


def instrument_graphql_client(client: Client) -> Client:
    """Instrumented GraphQL client.

    This wraps the generated AsyncBaseClient to add OpenTelemetry tracing
    without modifying the code-generated file itself. Since code-gen may
    overwrite AsyncBaseClient in future runs, this wrapper provides a safe
    and stable place to extend the client with observability features.
    """

    original_execute_json = client._execute_json
    original_execute_multipart = client._execute_multipart

    async def traced_execute_json(
        query: str,
        operation_name: Optional[str],
        variables: Dict[str, Any],
        **kwargs: Any,
    ):
        headers = {"Content-Type": "application/json"}
        headers.update(kwargs.get("headers", {}))
        inject(headers)
        merged_kwargs = {**kwargs, "headers": headers}
        span_name = f"saleor.graphql.{operation_name or 'query'}"
        with tracer.start_as_current_span(
            span_name,
            kind=SpanKind.CLIENT,
            attributes={
                mcp_attributes.HTTP_METHOD: "POST",
                mcp_attributes.SALEOR_ENDPOINT: client.url,
                mcp_attributes.GRAPHQL_OPERATION_NAME: operation_name,
                mcp_attributes.GRAPHQL_VARIABLES: str(variables),
            },
        ) as span:
            response = await original_execute_json(
                query=query,
                operation_name=operation_name,
                variables=variables,
                **merged_kwargs,
            )
            span.set_attribute(mcp_attributes.HTTP_STATUS_CODE, response.status_code)
            return response

    async def traced_multipart(
        query: str,
        operation_name: Optional[str],
        variables: Dict[str, Any],
        files: Dict[str, Tuple[str, IO[bytes], str]],
        files_map: Dict[str, List[str]],
        **kwargs: Any,
    ):
        headers = kwargs.get("headers", {})
        inject(headers)
        merged_kwargs = {**kwargs, "headers": headers}
        span_name = f"saleor.graphql.{operation_name or 'multipart'}"
        with tracer.start_as_current_span(
            span_name,
            kind=SpanKind.CLIENT,
            attributes={
                mcp_attributes.HTTP_METHOD: "POST",
                mcp_attributes.SALEOR_ENDPOINT: client.url,
                mcp_attributes.GRAPHQL_OPERATION_NAME: operation_name,
                mcp_attributes.GRAPHQL_VARIABLES: str(variables),
                mcp_attributes.GRAPHQL_MULTIPART: True,
                mcp_attributes.GRAPHQL_FILES_COUNT: len(files),
            },
        ) as span:
            response = await original_execute_multipart(
                query=query,
                operation_name=operation_name,
                variables=variables,
                files=files,
                files_map=files_map,
                **merged_kwargs,
            )
            span.set_attribute(mcp_attributes.HTTP_STATUS_CODE, response.status_code)
            return response

    client._execute_json = traced_execute_json
    client._execute_multipart = traced_multipart
    return client
