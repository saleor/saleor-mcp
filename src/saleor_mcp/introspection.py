"""Schema discovery helpers backed by live introspection or bundled SDL.

The Saleor schema is very large (~45k lines), so these helpers never return the
whole schema. Instead they return narrow, targeted slices that an agent can use to
compose queries and mutations.
"""

import logging
import os
from collections import OrderedDict
from pathlib import Path
from typing import Any

from graphql import (
    GraphQLEnumType,
    GraphQLField,
    GraphQLInputField,
    GraphQLInputObjectType,
    GraphQLInterfaceType,
    GraphQLObjectType,
    GraphQLScalarType,
    GraphQLSchema,
    GraphQLUnionType,
    Undefined,
    build_client_schema,
    build_schema,
    get_introspection_query,
    print_ast,
)

from .config import SaleorConfig, get_saleor_config
from .gql_client import SaleorGraphQLError, execute_graphql

logger = logging.getLogger(__name__)

# Schema is identical per Saleor instance, so cache it by API URL. The cache is a
# bounded LRU because, on a hosted endpoint, the API URL is client-supplied: an
# unbounded dict would let anyone exhaust memory by sending many distinct URLs.
_SCHEMA_CACHE_MAXSIZE = 128
_schema_cache: "OrderedDict[str, GraphQLSchema]" = OrderedDict()

# Bundled SDL is static, so memoise it by resolved path to avoid re-parsing ~45k
# lines on every introspection fallback.
_bundled_schema_cache: dict[str, GraphQLSchema] = {}

_MAX_RESULTS = 50


def _schema_cache_get(key: str) -> GraphQLSchema | None:
    schema = _schema_cache.get(key)
    if schema is not None:
        _schema_cache.move_to_end(key)
    return schema


def _schema_cache_set(key: str, schema: GraphQLSchema) -> None:
    _schema_cache[key] = schema
    _schema_cache.move_to_end(key)
    while len(_schema_cache) > _SCHEMA_CACHE_MAXSIZE:
        _schema_cache.popitem(last=False)


def _bundled_schema_path() -> Path:
    override = os.getenv("SALEOR_SCHEMA_PATH")
    if override:
        return Path(override)
    return Path(__file__).resolve().parent.parent.parent / "schema.graphql"


def _load_bundled_schema() -> GraphQLSchema:
    path = _bundled_schema_path()
    key = str(path)
    cached = _bundled_schema_cache.get(key)
    if cached is not None:
        return cached
    sdl = path.read_text(encoding="utf-8")
    schema = build_schema(sdl, assume_valid=True)
    _bundled_schema_cache[key] = schema
    return schema


async def get_schema(config: SaleorConfig | None = None) -> GraphQLSchema:
    """Return the schema for the connected instance, caching the result.

    Tries live introspection first (so it matches the user's Saleor version), then
    falls back to the bundled ``schema.graphql``.

    Only a successful live introspection is cached per instance. The bundled fallback
    is intentionally not cached against the API URL, so a transient introspection
    failure cannot pin a generic schema to that instance for the rest of the process.
    """
    config = config or get_saleor_config()
    cache_key = config.api_url
    cached = _schema_cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        body = await execute_graphql(
            get_introspection_query(descriptions=True), config=config
        )
        data = body.get("data")
        if data:
            schema = build_client_schema(data)
            _schema_cache_set(cache_key, schema)
            return schema
        logger.warning("Introspection returned no data: %s", body.get("errors"))
    except SaleorGraphQLError as exc:
        logger.warning("Live introspection failed, falling back to bundled SDL: %s", exc)

    return _load_bundled_schema()


def _type_kind(type_: Any) -> str:
    if isinstance(type_, GraphQLObjectType):
        return "OBJECT"
    if isinstance(type_, GraphQLInputObjectType):
        return "INPUT_OBJECT"
    if isinstance(type_, GraphQLInterfaceType):
        return "INTERFACE"
    if isinstance(type_, GraphQLUnionType):
        return "UNION"
    if isinstance(type_, GraphQLEnumType):
        return "ENUM"
    if isinstance(type_, GraphQLScalarType):
        return "SCALAR"
    return "UNKNOWN"


def _default_value_repr(default: Any) -> Any:
    if default is Undefined:
        return None
    try:
        return print_ast(default) if hasattr(default, "kind") else default
    except Exception:
        return str(default)


def _describe_arg(name: str, arg: Any) -> dict[str, Any]:
    return {
        "name": name,
        "type": str(arg.type),
        "description": arg.description,
        "default": _default_value_repr(getattr(arg, "default_value", Undefined)),
    }


def _describe_field(name: str, fdef: GraphQLField) -> dict[str, Any]:
    return {
        "name": name,
        "type": str(fdef.type),
        "description": fdef.description,
        "args": [_describe_arg(an, a) for an, a in fdef.args.items()],
        "deprecationReason": fdef.deprecation_reason,
    }


def _describe_input_field(name: str, fdef: GraphQLInputField) -> dict[str, Any]:
    return {
        "name": name,
        "type": str(fdef.type),
        "description": fdef.description,
        "default": _default_value_repr(getattr(fdef, "default_value", Undefined)),
    }


def describe_type(schema: GraphQLSchema, name: str) -> dict[str, Any]:
    """Return a structured description of a single named type."""
    type_ = schema.get_type(name)
    if type_ is None:
        return {"error": f"Type '{name}' not found in the schema."}

    kind = _type_kind(type_)
    result: dict[str, Any] = {
        "name": name,
        "kind": kind,
        "description": type_.description,
    }

    if isinstance(type_, GraphQLObjectType | GraphQLInterfaceType):
        result["fields"] = [
            _describe_field(fn, fd) for fn, fd in type_.fields.items()
        ]
        if isinstance(type_, GraphQLObjectType):
            result["interfaces"] = [i.name for i in type_.interfaces]
    elif isinstance(type_, GraphQLInputObjectType):
        result["inputFields"] = [
            _describe_input_field(fn, fd) for fn, fd in type_.fields.items()
        ]
    elif isinstance(type_, GraphQLEnumType):
        result["enumValues"] = [
            {"name": vn, "description": v.description, "deprecationReason": v.deprecation_reason}
            for vn, v in type_.values.items()
        ]
    elif isinstance(type_, GraphQLUnionType):
        result["possibleTypes"] = [t.name for t in type_.types]

    return result


def search_schema(schema: GraphQLSchema, keyword: str, limit: int = _MAX_RESULTS) -> dict[str, Any]:
    """Search type and field names for a keyword (case-insensitive)."""
    needle = keyword.lower()
    type_matches: list[dict[str, str]] = []
    field_matches: list[dict[str, str]] = []

    for type_name, type_ in schema.type_map.items():
        if type_name.startswith("__"):
            continue
        if needle in type_name.lower():
            type_matches.append({"name": type_name, "kind": _type_kind(type_)})

        fields = getattr(type_, "fields", None)
        if not fields:
            continue
        for field_name in fields:
            if needle in field_name.lower():
                field_matches.append({"type": type_name, "field": field_name})
                if len(field_matches) >= limit * 4:
                    break

    return {
        "keyword": keyword,
        "types": type_matches[:limit],
        "fields": field_matches[:limit],
        "truncated": len(type_matches) > limit or len(field_matches) > limit,
    }


def list_operations(
    schema: GraphQLSchema, kind: str, search: str | None = None, limit: int = _MAX_RESULTS
) -> dict[str, Any]:
    """List available root operations (queries or mutations)."""
    kind_normalized = kind.lower()
    if kind_normalized in ("query", "queries"):
        root = schema.query_type
    elif kind_normalized in ("mutation", "mutations"):
        root = schema.mutation_type
    else:
        return {"error": "kind must be 'query' or 'mutation'."}

    if root is None:
        return {"kind": kind_normalized, "operations": [], "totalCount": 0}

    needle = search.lower() if search else None
    operations = []
    for op_name, fdef in root.fields.items():
        if needle and needle not in op_name.lower():
            continue
        operations.append(
            {
                "name": op_name,
                "type": str(fdef.type),
                "description": (fdef.description or "").split("\n")[0],
            }
        )

    total = len(operations)
    return {
        "kind": kind_normalized,
        "operations": operations[:limit],
        "totalCount": total,
        "truncated": total > limit,
    }


def describe_operation(
    schema: GraphQLSchema, name: str, kind: str | None = None
) -> dict[str, Any]:
    """Return the full signature of a single query or mutation."""
    candidates = []
    if kind is None or kind.lower().startswith("query"):
        candidates.append(("query", schema.query_type))
    if kind is None or kind.lower().startswith("mutation"):
        candidates.append(("mutation", schema.mutation_type))

    for op_kind, root in candidates:
        if root is None:
            continue
        fdef = root.fields.get(name)
        if fdef is not None:
            return {"kind": op_kind, **_describe_field(name, fdef)}

    return {"error": f"Operation '{name}' not found as a query or mutation."}
