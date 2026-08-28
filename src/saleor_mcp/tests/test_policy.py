import pytest
from fastmcp.exceptions import ToolError

from saleor_mcp.config import Mode, PolicyConfig
from saleor_mcp.policy import (
    analyze_document,
    assert_mutation_allowed,
    assert_query_allowed,
)

QUERY = "query { products(first: 1) { edges { node { id } } } }"
MUTATION = (
    'mutation { productCreate(input: {name: "x"}) { product { id } errors { field } } }'
)
DANGEROUS = "mutation { staffDelete(id: \"1\") { errors { field } } }"
SUBSCRIPTION = "subscription { event { issuedAt } }"


def test_analyze_query():
    analysis = analyze_document(QUERY)
    assert analysis.has_query
    assert not analysis.has_mutation
    assert analysis.query_fields == ["products"]


def test_analyze_mutation_root_fields():
    analysis = analyze_document(MUTATION)
    assert analysis.has_mutation
    assert analysis.mutation_fields == ["productCreate"]


def test_analyze_mutation_resolves_inline_fragment():
    # An inline fragment on the mutation root must not hide the field name.
    doc = "mutation { ... on Mutation { staffCreate(input: {}) { user { id } } } }"
    analysis = analyze_document(doc)
    assert analysis.has_mutation
    assert analysis.mutation_fields == ["staffCreate"]


def test_analyze_mutation_resolves_fragment_spread():
    doc = (
        "mutation { ...M } "
        "fragment M on Mutation { staffCreate(input: {}) { user { id } } }"
    )
    analysis = analyze_document(doc)
    assert analysis.mutation_fields == ["staffCreate"]


def test_blocklist_not_bypassed_by_fragment():
    # The whole point of fix #2: a wrapped high-risk mutation is still blocked.
    policy = PolicyConfig(mode=Mode.READ_WRITE, blocked_mutations={"staffCreate"})
    doc = "mutation { ... on Mutation { staffCreate(input: {}) { user { id } } } }"
    with pytest.raises(ToolError, match="blocked by the current safety policy"):
        assert_mutation_allowed(doc, policy)


def test_analyze_invalid_syntax():
    with pytest.raises(ToolError, match="Invalid GraphQL syntax"):
        analyze_document("query { products(")


def test_analyze_empty_document():
    with pytest.raises(ToolError, match="no executable operation"):
        analyze_document("fragment F on Product { id }")


def test_assert_query_allowed_rejects_mutation():
    with pytest.raises(ToolError, match="run_mutation"):
        assert_query_allowed(MUTATION)


def test_assert_query_allowed_rejects_subscription():
    with pytest.raises(ToolError, match="Subscriptions are not supported"):
        assert_query_allowed(SUBSCRIPTION)


def test_assert_query_allowed_accepts_query():
    analysis = assert_query_allowed(QUERY)
    assert analysis.has_query


def test_mutation_blocked_in_read_only():
    policy = PolicyConfig(mode=Mode.READ_ONLY)
    with pytest.raises(ToolError, match="read_only mode"):
        assert_mutation_allowed(MUTATION, policy)


def test_mutation_allowed_in_read_write():
    policy = PolicyConfig(mode=Mode.READ_WRITE, blocked_mutations={"staffDelete"})
    analysis = assert_mutation_allowed(MUTATION, policy)
    assert analysis.mutation_fields == ["productCreate"]


def test_dangerous_mutation_blocked_in_read_write():
    policy = PolicyConfig(mode=Mode.READ_WRITE, blocked_mutations={"staffDelete"})
    with pytest.raises(ToolError, match="blocked by the current safety policy"):
        assert_mutation_allowed(DANGEROUS, policy)


def test_dangerous_mutation_allowed_when_overridden():
    policy = PolicyConfig(
        mode=Mode.READ_WRITE,
        blocked_mutations={"staffDelete"},
        allowed_mutations={"staffDelete"},
    )
    analysis = assert_mutation_allowed(DANGEROUS, policy)
    assert analysis.mutation_fields == ["staffDelete"]


def test_unrestricted_allows_everything():
    policy = PolicyConfig(mode=Mode.UNRESTRICTED, blocked_mutations={"staffDelete"})
    analysis = assert_mutation_allowed(DANGEROUS, policy)
    assert analysis.mutation_fields == ["staffDelete"]


def test_run_mutation_rejects_pure_query():
    policy = PolicyConfig(mode=Mode.READ_WRITE)
    with pytest.raises(ToolError, match="no mutation"):
        assert_mutation_allowed(QUERY, policy)
