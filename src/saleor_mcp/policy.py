"""Parse and classify GraphQL documents, and enforce the safety policy."""

from dataclasses import dataclass, field

from fastmcp.exceptions import ToolError
from graphql import (
    FieldNode,
    OperationDefinitionNode,
    OperationType,
    parse,
)
from graphql.error import GraphQLSyntaxError

from .config import Mode, PolicyConfig


@dataclass
class DocumentAnalysis:
    """Result of statically analysing a GraphQL document."""

    operation_types: set[OperationType] = field(default_factory=set)
    mutation_fields: list[str] = field(default_factory=list)
    query_fields: list[str] = field(default_factory=list)
    operation_count: int = 0

    @property
    def has_mutation(self) -> bool:
        return OperationType.MUTATION in self.operation_types

    @property
    def has_query(self) -> bool:
        return OperationType.QUERY in self.operation_types

    @property
    def has_subscription(self) -> bool:
        return OperationType.SUBSCRIPTION in self.operation_types


def _root_field_names(operation: OperationDefinitionNode) -> list[str]:
    return [
        selection.name.value
        for selection in operation.selection_set.selections
        if isinstance(selection, FieldNode)
    ]


def analyze_document(query: str) -> DocumentAnalysis:
    """Statically analyse a GraphQL document.

    Raises :class:`ToolError` if the document cannot be parsed.
    """
    try:
        document = parse(query)
    except GraphQLSyntaxError as exc:
        raise ToolError(f"Invalid GraphQL syntax: {exc}") from exc

    analysis = DocumentAnalysis()
    for definition in document.definitions:
        if not isinstance(definition, OperationDefinitionNode):
            continue
        analysis.operation_count += 1
        analysis.operation_types.add(definition.operation)
        if definition.operation is OperationType.MUTATION:
            analysis.mutation_fields.extend(_root_field_names(definition))
        elif definition.operation is OperationType.QUERY:
            analysis.query_fields.extend(_root_field_names(definition))

    if analysis.operation_count == 0:
        raise ToolError(
            "The document contains no executable operation. Provide a query or "
            "mutation operation."
        )

    return analysis


def assert_query_allowed(query: str) -> DocumentAnalysis:
    """Validate a document submitted to ``run_query``.

    Only query operations are permitted. Mutations must go through ``run_mutation``
    so that the safety policy and write-approval flow apply.
    """
    analysis = analyze_document(query)

    if analysis.has_subscription:
        raise ToolError("Subscriptions are not supported by this server.")

    if analysis.has_mutation:
        raise ToolError(
            "This document contains a mutation. Use the 'run_mutation' tool for "
            "operations that modify data."
        )

    return analysis


def assert_mutation_allowed(query: str, policy: PolicyConfig) -> DocumentAnalysis:
    """Validate a document submitted to ``run_mutation`` against the policy."""
    analysis = analyze_document(query)

    if analysis.has_subscription:
        raise ToolError("Subscriptions are not supported by this server.")

    if not analysis.has_mutation:
        raise ToolError(
            "This document contains no mutation. Use the 'run_query' tool for "
            "read-only operations."
        )

    if analysis.has_query:
        raise ToolError(
            "Mixing query and mutation operations in one document is not allowed. "
            "Submit the mutation on its own."
        )

    if policy.mode is Mode.READ_ONLY:
        raise ToolError(
            "The server is running in read_only mode, so mutations are disabled. "
            "Set SALEOR_MCP_MODE=read_write (or unrestricted) to enable writes."
        )

    blocklist = policy.effective_blocklist
    blocked = sorted({f for f in analysis.mutation_fields if f in blocklist})
    if blocked:
        raise ToolError(
            "The following mutation(s) are blocked by the current safety policy: "
            f"{', '.join(blocked)}. These are considered high-risk (identity, access "
            "control, apps or instance settings). To allow them, add them to "
            "SALEOR_MCP_ALLOWED_MUTATIONS or set SALEOR_MCP_MODE=unrestricted."
        )

    return analysis
