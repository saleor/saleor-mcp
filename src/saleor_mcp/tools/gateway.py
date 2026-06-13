"""Generic Saleor GraphQL gateway tools.

Instead of curated per-domain tools, this exposes a small set of generic tools that
let an agent discover the schema and run arbitrary queries and mutations, gated by
the connected token's permissions plus the configured safety policy.
"""

from typing import Annotated, Any, Literal

from fastmcp import Context, FastMCP

from ..config import get_policy_config, get_saleor_config
from ..gql_client import SaleorGraphQLError, execute_graphql
from ..introspection import (
    describe_operation,
    describe_type,
    get_schema,
    list_operations,
    search_schema,
)
from ..policy import assert_mutation_allowed, assert_query_allowed

gateway_router = FastMCP("Saleor Gateway MCP")


@gateway_router.tool(
    annotations={
        "title": "Run GraphQL query",
        "readOnlyHint": True,
        "openWorldHint": True,
    }
)
async def run_query(
    ctx: Context,
    query: Annotated[
        str, "A GraphQL query document. Must contain only query operations."
    ],
    variables: Annotated[
        dict[str, Any] | None, "Variables for the query, as a JSON object."
    ] = None,
    operation_name: Annotated[
        str | None, "Operation name to run when the document defines several."
    ] = None,
) -> dict[str, Any]:
    """Execute a read-only GraphQL query against the connected Saleor instance.

    Use this to fetch any data the token is allowed to read. Documents containing
    mutations are rejected - use 'run_mutation' for writes. The returned object is the
    raw GraphQL response, preserving both 'data' and any GraphQL-level 'errors'.

    Discover what to query first with the 'introspect_schema' tool.
    """
    assert_query_allowed(query)
    try:
        return await execute_graphql(
            query, variables, operation_name=operation_name
        )
    except SaleorGraphQLError as e:
        await ctx.error(str(e))
        raise


@gateway_router.tool(
    annotations={
        "title": "Run GraphQL mutation",
        "readOnlyHint": False,
        "destructiveHint": True,
        "openWorldHint": True,
    }
)
async def run_mutation(
    ctx: Context,
    query: Annotated[
        str, "A GraphQL mutation document. Must contain only mutation operations."
    ],
    variables: Annotated[
        dict[str, Any] | None, "Variables for the mutation, as a JSON object."
    ] = None,
    operation_name: Annotated[
        str | None, "Operation name to run when the document defines several."
    ] = None,
) -> dict[str, Any]:
    """Execute a GraphQL mutation that modifies data in the connected Saleor instance.

    This writes data and is gated by the server's safety policy:
    - In read_only mode (the default) mutations are disabled.
    - In read_write mode a denylist of high-risk mutations (identity, access control,
      apps, instance settings) is enforced.
    - In unrestricted mode any mutation the token allows can run.

    The returned object is the raw GraphQL response, preserving both 'data' and any
    GraphQL-level 'errors' (including Saleor's typed mutation errors).
    """
    policy = get_policy_config()
    assert_mutation_allowed(query, policy)
    try:
        return await execute_graphql(
            query, variables, operation_name=operation_name
        )
    except SaleorGraphQLError as e:
        await ctx.error(str(e))
        raise


@gateway_router.tool(
    annotations={
        "title": "Introspect schema",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def introspect_schema(
    ctx: Context,
    action: Annotated[
        Literal["search", "describe_type", "list_operations", "describe_operation"],
        "What to do: 'search' names by keyword, 'describe_type' a named type, "
        "'list_operations' the queries or mutations, 'describe_operation' a single "
        "query/mutation signature.",
    ],
    name: Annotated[
        str | None,
        "Type or operation name (for 'describe_type' and 'describe_operation').",
    ] = None,
    kind: Annotated[
        Literal["query", "mutation"] | None,
        "Operation kind (for 'list_operations' and 'describe_operation').",
    ] = None,
    search: Annotated[
        str | None,
        "Keyword to search/filter by (for 'search' and 'list_operations').",
    ] = None,
) -> dict[str, Any]:
    """Explore the Saleor GraphQL schema in small, targeted slices.

    The schema is too large to return whole, so use this to drill in:
    - search: find types and fields matching a keyword.
    - list_operations: list available queries or mutations (optionally filtered).
    - describe_operation: get a single query/mutation's arguments and return type.
    - describe_type: get a type's fields, input fields, enum values or members.

    Discovery uses live introspection of the connected instance when available, and
    falls back to a bundled schema otherwise.
    """
    try:
        schema = await get_schema()
    except SaleorGraphQLError as e:
        await ctx.error(str(e))
        raise

    if action == "search":
        if not search:
            return {"error": "The 'search' action requires the 'search' argument."}
        return search_schema(schema, search)

    if action == "list_operations":
        if not kind:
            return {
                "error": "The 'list_operations' action requires the 'kind' argument "
                "('query' or 'mutation')."
            }
        return list_operations(schema, kind, search)

    if action == "describe_type":
        if not name:
            return {"error": "The 'describe_type' action requires the 'name' argument."}
        return describe_type(schema, name)

    if action == "describe_operation":
        if not name:
            return {
                "error": "The 'describe_operation' action requires the 'name' argument."
            }
        return describe_operation(schema, name, kind)

    return {"error": f"Unknown action '{action}'."}


_CONNECTION_QUERY = """
query SaleorMcpConnectionInfo {
  me {
    email
    isStaff
    userPermissions { code }
  }
  app {
    name
    permissions { code }
  }
  shop {
    name
    version
  }
}
"""


@gateway_router.tool(
    annotations={
        "title": "Connection info",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": True,
    }
)
async def connection_info(ctx: Context) -> dict[str, Any]:
    """Report the connected instance, the token's permissions and the safety policy.

    Call this first to learn which Saleor instance you are connected to, what the
    authenticated user/app is allowed to do, and which write operations the server
    will permit. Use it to explain up front what is and isn't possible.

    Note: 'mode', 'writesEnabled' and 'blockedMutations' reflect the server-wide
    safety policy (configured via environment variables), not anything specific to
    this token. The token's own permissions remain the final authority.
    """
    config = get_saleor_config()
    policy = get_policy_config()

    identity: dict[str, Any] = {}
    try:
        body = await execute_graphql(_CONNECTION_QUERY, config=config)
        data = body.get("data") or {}
        me = data.get("me")
        app = data.get("app")
        shop = data.get("shop")
        if me:
            identity["user"] = {
                "email": me.get("email"),
                "isStaff": me.get("isStaff"),
                "permissions": [p["code"] for p in me.get("userPermissions") or []],
            }
        if app:
            identity["app"] = {
                "name": app.get("name"),
                "permissions": [p["code"] for p in app.get("permissions") or []],
            }
        if shop:
            identity["shop"] = shop
    except SaleorGraphQLError as e:
        identity["warning"] = f"Could not read identity/permissions: {e}"

    return {
        "apiUrl": config.api_url,
        "mode": policy.mode.value,
        "writesEnabled": policy.mode.value != "read_only",
        "blockedMutations": sorted(policy.effective_blocklist),
        **identity,
    }
